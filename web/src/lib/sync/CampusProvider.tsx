"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { clearMailCache } from "../connectors/connectors.ts";
import { connectSystem, disconnectSystem, getConnections, CONNECTIONS_KEY, type Connections } from "../connectors/connections.ts";
import { SYSTEM_IDS, type SystemId } from "../world/types.ts";
import { getCustomNotices, getTriggeredEvents, resetScenario, subscribeScenario } from "../world/storage.ts";
import { mergePending } from "./diff.ts";
import { syncAll } from "./engine.ts";
import { clearSyncState, loadSyncState, saveSyncState } from "./store.ts";
import { EMPTY_SYNC, type Change, type Snapshot, type SyncFailure, type SyncState } from "./types.ts";
import { baseCampusData, campusDataFrom, type CampusData } from "./view.ts";

const ACK_KEY = "compass:acknowledged:v1";

type CampusCtx = {
  hydrated: boolean;
  connections: Connections;
  connected: SystemId[];
  syncing: boolean;
  lastSyncAt?: string;
  failed: SyncFailure[];
  snapshot: Snapshot | null;
  /** Changes from sync that the student has not reviewed yet. */
  changes: Change[];
  acknowledged: string[];
  data: CampusData;
  connect: (system: SystemId) => boolean;
  disconnect: (system: SystemId) => void;
  syncNow: () => Promise<void>;
  acknowledge: (ids: string[]) => void;
  unacknowledge: (ids: string[]) => void;
  resetAll: () => void;
};

const Ctx = createContext<CampusCtx | null>(null);
const connectedOf = (c: Connections): SystemId[] => SYSTEM_IDS.filter((s) => c[s]);

function readAck(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ACK_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(-300) : [];
  } catch { return []; }
}

type Local = { hydrated: boolean; connections: Connections; sync: SyncState; syncing: boolean; acknowledged: string[] };
type Act =
  | { type: "hydrate"; connections: Connections; sync: SyncState; acknowledged: string[] }
  | { type: "sync"; sync: SyncState }
  | { type: "syncing"; value: boolean }
  | { type: "connections"; connections: Connections }
  | { type: "ack"; acknowledged: string[] }
  | { type: "reset" };

const INITIAL: Local = { hydrated: false, connections: {}, sync: EMPTY_SYNC, syncing: false, acknowledged: [] };

function reduce(s: Local, a: Act): Local {
  switch (a.type) {
    case "hydrate": return { ...s, hydrated: true, connections: a.connections, sync: a.sync, acknowledged: a.acknowledged };
    case "sync": return { ...s, sync: a.sync };
    case "syncing": return { ...s, syncing: a.value };
    case "connections": return { ...s, connections: a.connections };
    case "ack": return { ...s, acknowledged: a.acknowledged };
    case "reset": return { ...INITIAL, hydrated: true };
  }
}

export function CampusProvider({ children }: { children: ReactNode }) {
  const bare = (usePathname() ?? "").startsWith("/demo"); // the console window never syncs
  const [local, dispatch] = useReducer(reduce, INITIAL);
  const { hydrated, connections, sync, syncing, acknowledged } = local;
  const ackRef = useRef<string[]>([]);
  const stateRef = useRef<SyncState>(EMPTY_SYNC);
  const running = useRef(false);
  const again = useRef(false);

  const commit = useCallback((next: SyncState) => {
    stateRef.current = next;
    saveSyncState(next);
    dispatch({ type: "sync", sync: next });
  }, []);

  const syncNow = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    if (connectedOf(getConnections()).length === 0) return;
    running.current = true;
    dispatch({ type: "syncing", value: true });
    try {
      do {
        again.current = false;
        const connected = connectedOf(getConnections());
        if (connected.length === 0) break;
        const prev = stateRef.current;
        const out = await syncAll({
          connected, previous: prev.snapshot,
          env: {
            fetcher: (input, init) => fetch(input, init),
            events: getTriggeredEvents(), outageSeen: prev.outageSeen, custom: getCustomNotices(),
            now: () => new Date().toISOString(),
          },
        });
        const seen = new Set(prev.outageSeen);
        for (const f of out.failed) if (f.error.outageEvent) seen.add(f.error.outageEvent);
        commit({
          snapshot: out.snapshot,
          pending: mergePending(prev.pending.filter((c) => connected.includes(c.system)), out.changes),
          failed: out.failed, lastSyncAt: new Date().toISOString(), outageSeen: [...seen],
        });
      } while (again.current);
    } finally {
      running.current = false;
      dispatch({ type: "syncing", value: false });
    }
  }, [commit]);

  // hydrate once, then keep in step with the console window
  useEffect(() => {
    if (bare) return;
    const saved = loadSyncState();
    stateRef.current = saved;
    const conn = getConnections();
    ackRef.current = readAck();
    dispatch({ type: "hydrate", connections: conn, sync: saved, acknowledged: ackRef.current });
    if (connectedOf(conn).length) void syncNow();
    return subscribeScenario(() => { void syncNow(); });
  }, [syncNow, bare]);

  const connect = useCallback((system: SystemId) => {
    const next = connectSystem(system, new Date().toISOString());
    if (!next) return false;
    dispatch({ type: "connections", connections: next });
    void syncNow();
    return true;
  }, [syncNow]);

  const disconnect = useCallback((system: SystemId) => {
    dispatch({ type: "connections", connections: disconnectSystem(system) });
    const prev = stateRef.current;
    if (!prev.snapshot) return;
    const asOf = { ...prev.snapshot.asOf };
    const fetchedAt = { ...prev.snapshot.fetchedAt };
    delete asOf[system];
    delete fetchedAt[system];
    const snapshot: Snapshot = {
      ...prev.snapshot, asOf, fetchedAt,
      items: prev.snapshot.items.filter((i) => i.source !== system),
      account: system === "finance" ? undefined : prev.snapshot.account,
    };
    commit({ ...prev, snapshot, pending: prev.pending.filter((c) => c.system !== system), failed: prev.failed.filter((f) => f.system !== system) });
  }, [commit]);

  const setAck = useCallback((next: string[]) => {
    ackRef.current = next;
    try { localStorage.setItem(ACK_KEY, JSON.stringify(next.slice(-300))); } catch {}
    dispatch({ type: "ack", acknowledged: next });
  }, []);
  const acknowledge = useCallback((ids: string[]) => setAck([...new Set([...ackRef.current, ...ids])]), [setAck]);
  const unacknowledge = useCallback((ids: string[]) => setAck(ackRef.current.filter((id) => !ids.includes(id))), [setAck]);

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(CONNECTIONS_KEY); localStorage.removeItem(ACK_KEY); } catch {}
    clearSyncState();
    resetScenario();
    clearMailCache();
    stateRef.current = EMPTY_SYNC;
    ackRef.current = [];
    dispatch({ type: "reset" });
  }, []);

  const connected = useMemo(() => connectedOf(connections), [connections]);
  const changes = useMemo(() => sync.pending.filter((c) => !acknowledged.includes(c.id)), [sync.pending, acknowledged]);
  const data = useMemo(
    () => (sync.snapshot && connected.length ? campusDataFrom(sync.snapshot.items, sync.snapshot.account, connected.filter((s) => sync.snapshot?.asOf[s])) : baseCampusData()),
    [sync.snapshot, connected],
  );

  const value = useMemo<CampusCtx>(() => ({
    hydrated, connections, connected, syncing, lastSyncAt: sync.lastSyncAt, failed: sync.failed, snapshot: sync.snapshot,
    changes, acknowledged, data, connect, disconnect, syncNow, acknowledge, unacknowledge, resetAll,
  }), [hydrated, connections, connected, syncing, sync, changes, acknowledged, data, connect, disconnect, syncNow, acknowledge, unacknowledge, resetAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCampus(): CampusCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCampus outside CampusProvider");
  return c;
}
