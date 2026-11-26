import { COURSE_BY_ID, type ClassSession, type Notice } from "../data/academics.ts";
import { SLOTS, type LibraryBooking } from "../library/policy.ts";
import { LIBRARY_ROOM_BY_ID } from "../library/rooms.ts";
import type { StudySession } from "../planning.ts";
import { atDay } from "../time.ts";
import { LECTURER } from "./cohort.ts";
import { dayLabel, overlaps, slotLabel } from "./time.ts";
import type { ReplacementRequest, SlotOption } from "./types.ts";

const codeOf = (courseId: string) => COURSE_BY_ID[courseId]?.code ?? courseId.toUpperCase();
const reasonText = (r: ReplacementRequest) =>
  r.reason === "Public holiday" ? "because of the public holiday" : r.reason === "Lecturer on leave" ? "because the lecturer is on leave" : "";

/** The one sentence Compass shows about a request. */
export function describeRequest(r: ReplacementRequest, lost: Pick<ClassSession, "day" | "start" | "kind">): { title: string; body: string } {
  const what = `${codeOf(r.courseId)} ${lost.kind.toLowerCase()}`;
  const why = reasonText(r);
  const note = r.note ? ` Note from ${LECTURER.name}: "${r.note}"` : "";
  if (r.status === "scheduled" && r.chosen) {
    return {
      title: `${codeOf(r.courseId)} replacement class: ${slotLabel(r.chosen)}`,
      body: `The ${what} on ${dayLabel(lost.day)} at ${lost.start} is cancelled${why ? ` ${why}` : ""}. The replacement class is on ${slotLabel(r.chosen)} in ${r.chosen.room}.${note}`,
    };
  }
  return {
    title: `${codeOf(r.courseId)} ${lost.kind.toLowerCase()} on ${dayLabel(lost.day)} is cancelled`,
    body: `${LECTURER.name} cancelled the ${what} on ${dayLabel(lost.day)} at ${lost.start}${why ? ` ${why}` : ""} and is choosing a replacement time. Tell them which of ${r.options.length} times work for you.${note}`,
  };
}

/**
 * The student's timetable and notices with the lecturer's replacements applied: the lost class is cancelled,
 * and a set replacement is added as its own session. Requests for classes the student does not have are ignored.
 */
export function applyReplacements(classes: readonly ClassSession[], notices: readonly Notice[], requests: readonly ReplacementRequest[]): { classes: ClassSession[]; notices: Notice[] } {
  let outClasses = [...classes];
  const added: Notice[] = [];
  for (const r of requests) {
    const lost = outClasses.find((c) => c.id === r.sessionId && c.courseId === r.courseId && !c.replacementId);
    if (!lost) continue;
    const noticeId = `rpl-${r.id}`;
    const { title, body } = describeRequest(r, lost);
    outClasses = outClasses.map((c) => (c === lost ? { ...c, status: "cancelled", noticeId } : c));
    if (r.status === "scheduled" && r.chosen) {
      outClasses.push({ id: `rpl-${r.id}`, courseId: r.courseId, day: r.chosen.day, start: r.chosen.start, end: r.chosen.end, kind: lost.kind, room: r.chosen.room, status: "makeup", noticeId, replacementId: r.id });
    }
    added.push({ id: noticeId, kind: "cancellation", courseId: r.courseId, title, body, posted: r.updatedAt, source: `${LECTURER.name}, lecturer` });
  }
  return { classes: outClasses, notices: [...added.sort((a, b) => Date.parse(b.posted) - Date.parse(a.posted)), ...notices] };
}

const ms = (day: number, hhmm: string) => atDay(day, hhmm).getTime();

/**
 * What only the student can see about one time: clashes with their own classes, study sessions and library bookings.
 * None of this is shared with the lecturer.
 */
export function personalClashes(slot: Pick<SlotOption, "day" | "start" | "end">, mine: { classes: readonly ClassSession[]; studySessions: readonly StudySession[]; bookings: readonly LibraryBooking[]; ignoreSessionId?: string }): string[] {
  const out: string[] = [];
  for (const c of mine.classes) {
    if (c.status === "cancelled" || c.id === mine.ignoreSessionId) continue;
    if (overlaps(c, slot)) out.push(`Clashes with your ${codeOf(c.courseId)} ${c.kind.toLowerCase()} at ${c.start}`);
  }
  const a = ms(slot.day, slot.start), b = ms(slot.day, slot.end);
  for (const s of mine.studySessions) {
    if (Date.parse(s.start) < b && a < Date.parse(s.end)) out.push(`Overlaps your study session "${s.title}"`);
  }
  for (const bk of mine.bookings) {
    const slotTimes = SLOTS[bk.slot];
    if (!slotTimes) continue;
    const s = Date.parse(`${bk.date}T${slotTimes.start}:00+08:00`), e = Date.parse(`${bk.date}T${slotTimes.end}:00+08:00`);
    if (s < b && a < e) out.push(`Overlaps your library booking in ${LIBRARY_ROOM_BY_ID[bk.roomId]?.name ?? bk.roomId}`);
  }
  return out;
}
