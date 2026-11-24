"use client";

import { useEffect, useState } from "react";
import { getTriggeredEvents, subscribeScenario } from "@/lib/world/storage";
import { fetchLedger } from "./client";
import type { LedgerEntry } from "./ledger";

type State = { entries: LedgerEntry[]; outstanding: number; error: string; ready: boolean };
const EMPTY: State = { entries: [], outstanding: 0, error: "", ready: false };

/** The account statement, read from the finance mock. It reloads when the console changes the scenario. */
export function useLedger(enabled = true): State {
  const [state, setState] = useState<State>(EMPTY);
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeScenario(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    fetchLedger(getTriggeredEvents(), ac.signal)
      .then((r) => setState({ entries: r.entries, outstanding: r.outstanding, error: "", ready: true }))
      .catch((e: unknown) => { if (!ac.signal.aborted) setState((cur) => ({ ...cur, error: e instanceof Error ? e.message : "The finance system did not answer.", ready: true })); });
    return () => ac.abort();
  }, [enabled, tick]);
  return enabled ? state : EMPTY;
}
