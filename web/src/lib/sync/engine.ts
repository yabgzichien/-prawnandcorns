import { CONNECTORS } from "../connectors/connectors.ts";
import type { Connector, ConnectorEnv, ConnectorResult } from "../connectors/types.ts";
import { SYSTEM_IDS, type SystemId } from "../world/types.ts";
import { diffSnapshots } from "./diff.ts";
import type { Snapshot, SyncFailure, SyncOutcome } from "./types.ts";

/**
 * Runs every connected connector at the same time. A failure in one never stops the others:
 * the failed system keeps its last known data (and its older timestamp) and is reported in `failed`.
 */
export async function syncAll(options: {
  connected: readonly SystemId[];
  previous: Snapshot | null;
  env: ConnectorEnv;
  connectors?: Record<SystemId, Connector>;
}): Promise<SyncOutcome> {
  const { connected, previous, env } = options;
  const connectors = options.connectors ?? CONNECTORS;
  const targets = SYSTEM_IDS.filter((s) => connected.includes(s));

  const results: ConnectorResult[] = await Promise.all(targets.map(async (system): Promise<ConnectorResult> => {
    try { return await connectors[system].fetch(env); }
    catch { return { ok: false, system, error: { code: "bad_response", message: "Something went wrong while reading this system." } }; }
  }));

  const snapshot: Snapshot = { takenAt: env.now(), asOf: {}, fetchedAt: {}, items: [] };
  const failed: SyncFailure[] = [];
  for (const result of results) {
    if (result.ok) {
      snapshot.items.push(...result.items);
      snapshot.asOf[result.system] = [...env.events];
      snapshot.fetchedAt[result.system] = result.fetchedAt;
      if (result.account) snapshot.account = result.account;
    } else {
      failed.push({ system: result.system, error: result.error });
      const known = previous?.asOf[result.system];
      if (previous && known) {
        snapshot.items.push(...previous.items.filter((i) => i.source === result.system));
        snapshot.asOf[result.system] = known;
        const at = previous.fetchedAt[result.system];
        if (at) snapshot.fetchedAt[result.system] = at;
        if (result.system === "finance" && previous.account) snapshot.account = previous.account;
      }
    }
  }
  return { snapshot, changes: diffSnapshots(previous, snapshot), failed };
}
