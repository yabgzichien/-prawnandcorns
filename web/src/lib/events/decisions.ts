import { DECIDED, DECISIONS_KEY, LINE_STATUSES, type Decided, type Decisions, type EventApplication, type EventDecision, type EventLine, type LineDecision, type LineStatus } from "./types.ts";
import { VENUE_BY_ID } from "./catalogue.ts";

export { DECISIONS_KEY };

const MY_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;
export const APP_ID = /^DEMO-EVT-\d{4,6}$/;
export const LINE_ID = /^[a-z]\d{1,3}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const REMARK_MAX = 200;
/** The remark the desk writes when it swaps a room. The student already sees the swap in words, so this is not shown twice. */
export const AUTO_SWAP = /^You asked for [A-Z0-9-]+\. [A-Z0-9-]+ is given instead\.$/;

/** What the desk has said about one line, or Pending when it has said nothing. */
export function lineDecision(decisions: Decisions, appId: string, lineId: string): LineDecision | undefined {
  return decisions[appId]?.lines[lineId];
}

export const lineStatusOf = (decisions: Decisions, appId: string, lineId: string): LineStatus => lineDecision(decisions, appId, lineId)?.status ?? "Pending";

/** The room a venue line really has: the one staff assigned, or the one the club asked for. */
export function effectiveVenueId(decisions: Decisions, appId: string, line: EventLine): string | null {
  if (line.kind !== "venue") return null;
  return lineDecision(decisions, appId, line.id)?.assignedVenueId ?? line.venueId;
}

/** How many of an item the club really has: what staff approved, or what was asked for. */
export function effectiveQty(decisions: Decisions, appId: string, line: EventLine): number {
  if (line.kind !== "item") return 0;
  return lineDecision(decisions, appId, line.id)?.approvedQty ?? line.qty;
}

/**
 * The status of the whole event, worked out from its lines. Pending until every line has an answer. The real slips
 * say "Approve With Condition" for the event when any line carries a condition or was refused, so this does too.
 */
export function deriveEventStatus(statuses: readonly LineStatus[]): LineStatus {
  if (statuses.length === 0 || statuses.includes("Pending")) return "Pending";
  if (statuses.every((s) => s === "Rejected")) return "Rejected";
  if (statuses.every((s) => s === "Approved")) return "Approved";
  return "Approve With Condition";
}

export const linesStatuses = (app: EventApplication, decisions: Decisions): LineStatus[] => app.lines.map((l) => lineStatusOf(decisions, app.id, l.id));
export const eventStatusOf = (app: EventApplication, decisions: Decisions): LineStatus => decisions[app.id]?.eventStatus ?? deriveEventStatus(linesStatuses(app, decisions));

/** Counts for a queue badge: how many lines are still waiting. */
export const pendingCount = (app: EventApplication, decisions: Decisions): number => linesStatuses(app, decisions).filter((s) => s === "Pending").length;
export const hasAnyDecision = (app: EventApplication, decisions: Decisions): boolean => app.lines.some((l) => lineDecision(decisions, app.id, l.id));

/** Folds a new batch of line decisions into what the desk already said. Later answers replace earlier ones for the same line. */
export function applyDecisionBatch(
  decisions: Decisions,
  app: EventApplication,
  batch: Record<string, LineDecision>,
  options: { sentAt: string; eventStatus?: LineStatus; eventRemark?: string },
): Decisions {
  const lines: Record<string, LineDecision> = { ...(decisions[app.id]?.lines ?? {}) };
  for (const line of app.lines) if (batch[line.id]) lines[line.id] = batch[line.id];
  const merged: Decisions = { ...decisions, [app.id]: { eventStatus: "Pending", sentAt: options.sentAt, lines } };
  const derived = deriveEventStatus(app.lines.map((l) => lines[l.id]?.status ?? "Pending"));
  merged[app.id] = {
    eventStatus: options.eventStatus && LINE_STATUSES.includes(options.eventStatus) ? options.eventStatus : derived,
    sentAt: options.sentAt,
    lines,
    ...(options.eventRemark?.trim() ? { eventRemark: options.eventRemark.trim().slice(0, REMARK_MAX) } : {}),
  };
  return merged;
}

/** Cleans whatever was read from storage so a damaged or tampered value cannot break a page. */
export function sanitizeDecisions(raw: unknown): Decisions {
  const out: Decisions = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [appId, value] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
    if (!APP_ID.test(appId) || !value || typeof value !== "object") continue;
    const v = value as Partial<EventDecision>;
    if (!LINE_STATUSES.includes(v.eventStatus as LineStatus) || typeof v.sentAt !== "string" || !MY_ISO.test(v.sentAt)) continue;
    const lines: Record<string, LineDecision> = {};
    for (const [lineId, d] of Object.entries(v.lines && typeof v.lines === "object" ? v.lines : {}).slice(0, 30)) {
      if (!LINE_ID.test(lineId) || !d || typeof d !== "object") continue;
      const x = d as Partial<LineDecision>;
      if (!DECIDED.includes(x.status as Decided) || typeof x.updatedAt !== "string" || !MY_ISO.test(x.updatedAt)) continue;
      const remark = text(x.remark, REMARK_MAX);
      const qty = Number.isInteger(x.approvedQty) && (x.approvedQty as number) >= 1 && (x.approvedQty as number) <= 999 ? (x.approvedQty as number) : undefined;
      lines[lineId] = {
        status: x.status as Decided,
        updatedAt: x.updatedAt,
        ...(remark ? { remark } : {}),
        ...(typeof x.assignedVenueId === "string" && VENUE_BY_ID[x.assignedVenueId] ? { assignedVenueId: x.assignedVenueId } : {}),
        ...(qty ? { approvedQty: qty } : {}),
      };
    }
    const eventRemark = text(v.eventRemark, REMARK_MAX);
    out[appId] = { eventStatus: v.eventStatus as LineStatus, sentAt: v.sentAt, lines, ...(eventRemark ? { eventRemark } : {}) };
  }
  return out;
}

export function parseDecisions(textValue: string): Decisions {
  try { return sanitizeDecisions(JSON.parse(textValue)); } catch { return {}; }
}

/** What the student has already been told: application id to the status they last saw. Compass writes it. */
export function sanitizeSeen(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) if (APP_ID.test(id) && typeof v === "string" && v.length <= 80) out[id] = v;
  return out;
}

/** A short fingerprint of what the desk has said, so Compass can tell when something new arrived. */
export function decisionStamp(app: EventApplication, decisions: Decisions): string {
  const d = decisions[app.id];
  if (!d) return "";
  const text = [d.eventStatus, d.eventRemark ?? "", ...app.lines.map((l) => { const x = d.lines[l.id]; return x ? `${x.status}~${x.remark ?? ""}~${x.assignedVenueId ?? ""}~${x.approvedQty ?? ""}` : "P"; })].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

