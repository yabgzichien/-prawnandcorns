import { CLASSES, sessionDate, type ClassSession } from "./data/academics";
import { DEMO_NOW } from "./time";

export const TODAY_IDX = 0; // the demo "now" is Monday 23 Nov 2026, 13:20

export const classesOn = (day: number, classes: readonly ClassSession[] = CLASSES) => classes.filter((c) => c.day === day).sort((a, b) => a.start.localeCompare(b.start));

export function upcomingClasses(from: Date = DEMO_NOW, classes: readonly ClassSession[] = CLASSES): ClassSession[] {
  return classes.filter((c) => c.status !== "cancelled" && sessionDate(c).end > from).sort((a, b) => sessionDate(a).start.getTime() - sessionDate(b).start.getTime());
}

export const statusText = (c: ClassSession) =>
  c.status === "cancelled" ? "Cancelled" : c.status === "room-changed" ? "Room changed" : c.status === "makeup" ? "Make-up class" : "";
