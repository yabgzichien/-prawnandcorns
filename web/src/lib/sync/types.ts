import type { AccountSummary, CampusItem, ConnectorError } from "../connectors/types.ts";
import type { SystemId } from "../world/types.ts";

export type Snapshot = {
  takenAt: string;
  /** For each system, the scenario events that were active when its data was last fetched. */
  asOf: Partial<Record<SystemId, string[]>>;
  fetchedAt: Partial<Record<SystemId, string>>;
  items: CampusItem[];
  account?: AccountSummary;
};

export type FieldChange = { field: string; from: string; to: string };

export type Change = {
  /** Stable. Depends only on the item and what changed, so the server can recompute it. */
  id: string;
  type: "added" | "removed" | "changed";
  system: SystemId;
  itemId: string;
  itemKind: CampusItem["kind"];
  /** The item as it is now (or as it was, for a removal). */
  item: CampusItem;
  before?: CampusItem;
  fields?: FieldChange[];
  /** Active scenario events for this system before and after the change. The server rebuilds both. */
  since: string[];
  now: string[];
};

export type SyncFailure = { system: SystemId; error: ConnectorError };
export type SyncOutcome = { snapshot: Snapshot; changes: Change[]; failed: SyncFailure[] };

export type SyncState = {
  snapshot: Snapshot | null;
  pending: Change[];
  failed: SyncFailure[];
  lastSyncAt?: string;
  /** Outage events this browser has already experienced once. */
  outageSeen: string[];
};

export const EMPTY_SYNC: SyncState = { snapshot: null, pending: [], failed: [], outageSeen: [] };
