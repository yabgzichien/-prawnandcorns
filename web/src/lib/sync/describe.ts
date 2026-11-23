import type { CampusItem, ClassItem } from "../connectors/types.ts";
import { SYSTEM_SHORT } from "../world/types.ts";
import { dateShort, dayShort, timeOf } from "../time.ts";
import type { Change } from "./types.ts";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const when = (iso: string) => { const d = new Date(iso); return `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}`; };
const money = (currency: string, n: number) => `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const classLabel = (c: ClassItem) => `${c.courseCode} ${c.sessionKind} on ${DAYS[c.day]} ${c.start}`;
const from = (c: Change) => `(source: ${SYSTEM_SHORT[c.system]})`;

/** One plain sentence per change, always naming the system it came from. */
export function describeChange(change: Change): string {
  const item = change.item;
  const src = from(change);
  if (change.type === "added") return `${describeNew(item)} ${src}`;
  if (change.type === "removed") return `${describeGone(item)} ${src}`;

  const f = new Map((change.fields ?? []).map((x) => [x.field, x]));
  const parts: string[] = [];
  if (item.kind === "class") {
    const before = change.before?.kind === "class" ? change.before : item;
    const label = classLabel({ ...item, start: f.get("start")?.from ?? item.start, day: before.day });
    if (f.has("status") && item.status === "cancelled") parts.push(`${label} is now cancelled`);
    if (f.has("room")) parts.push(`Room for ${label} changed from ${f.get("room")!.from} to ${f.get("room")!.to}`);
    if (f.has("start") || f.has("end") || f.has("day")) parts.push(`${item.courseCode} ${item.sessionKind} moved to ${DAYS[item.day]} ${item.start} to ${item.end}`);
    if (!parts.length && f.has("status")) parts.push(`${label} is now ${item.status}`);
  } else if (item.kind === "deadline") {
    const label = `${item.title} (${item.courseCode})`;
    if (f.has("due")) parts.push(`Deadline for ${label} moved from ${when(f.get("due")!.from)} to ${when(f.get("due")!.to)}`);
    if (f.has("submission")) parts.push(item.submitted ? `${label} is now marked as submitted` : `${label} is now marked ${item.submission === "draft" ? "as in progress" : "as not submitted"}`);
    if (f.has("title")) parts.push(`${label} was renamed from "${f.get("title")!.from}"`);
  } else if (item.kind === "fee") {
    const label = item.description;
    if (f.has("status")) parts.push(`${label} is now ${f.get("status")!.to}`);
    if (f.has("amount")) parts.push(`${label} changed from ${money(item.currency, Number(f.get("amount")!.from))} to ${money(item.currency, item.amount)}`);
    if (f.has("due")) parts.push(`${label} due date moved from ${when(f.get("due")!.from)} to ${when(f.get("due")!.to)}`);
  }
  return `${parts.join(". ") || `${item.id} changed`} ${src}`;
}

function describeNew(item: CampusItem): string {
  switch (item.kind) {
    case "class": return `New class: ${item.courseCode} ${item.sessionKind}, ${DAYS[item.day]} ${item.start} to ${item.end} in ${item.room}${item.status === "make-up" ? " (make-up)" : ""}`;
    case "deadline": return `New ${item.activity === "Quiz" ? "quiz" : "deadline"}: ${item.title} (${item.courseCode}), due ${when(item.due)}`;
    case "fee": return `New fee posted: ${item.description}, ${money(item.currency, item.amount)}, due ${when(item.due)}`;
    case "notice": return item.source === "mail" ? `New email from ${item.sender}: "${item.subject}"` : `New ${item.source === "ac" ? "academic notice" : "course announcement"}: "${item.subject}"`;
    case "event": return `New event: ${item.title} on ${when(item.date)}`;
  }
}

function describeGone(item: CampusItem): string {
  switch (item.kind) {
    case "class": return `${classLabel(item)} no longer appears on the timetable`;
    case "deadline": return `${item.title} (${item.courseCode}) no longer appears in Moodle`;
    case "fee": return `${item.description} no longer appears in the fee list`;
    case "notice": return `"${item.subject}" was removed`;
    case "event": return `${item.title} was removed`;
  }
}
