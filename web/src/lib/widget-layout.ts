// The Today cards, their default layout and how a saved layout is brought up to date. Pure, so tests can load it.

export type WidgetId = "calendar" | "next" | "alerts" | "due" | "today" | "fees" | "progress" | "clubs" | "find" | "headsup" | "plans";
export type WidgetPref = { id: WidgetId; hidden: boolean };

/** Today starts as the master calendar alone. Every other card is one switch away in Customise. */
export const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "calendar", hidden: false },
  { id: "next", hidden: true },
  { id: "alerts", hidden: true },
  { id: "due", hidden: true },
  { id: "today", hidden: true },
  { id: "clubs", hidden: true },
  { id: "find", hidden: true },
  { id: "fees", hidden: true },
  { id: "progress", hidden: true },
  { id: "headsup", hidden: true },
  { id: "plans", hidden: true },
];

/** The cards that, switched on together and in this order, make the reference Today layout. */
export const REFERENCE_LAYOUT: readonly WidgetId[] = ["next", "alerts", "due", "today", "clubs", "find"];

/** What Today showed before the master calendar existed. A saved layout equal to this was never customised. */
const LEGACY_DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "next", hidden: false },
  { id: "alerts", hidden: false },
  { id: "due", hidden: false },
  { id: "today", hidden: false },
  { id: "clubs", hidden: false },
  { id: "find", hidden: false },
  { id: "fees", hidden: true },
  { id: "progress", hidden: true },
  { id: "headsup", hidden: true },
  { id: "plans", hidden: true },
];
const sameLayout = (a: WidgetPref[], b: WidgetPref[]) => a.length === b.length && a.every((w, i) => w.id === b[i].id && w.hidden === b[i].hidden);

/**
 * Saved layouts from before a widget existed get it added, and unknown or repeated ids are dropped.
 * A layout saved before the master calendar that was never customised becomes the new default (the calendar alone).
 * A customised one keeps every choice and gains the calendar at the top.
 */
export function mergeWidgets(raw: unknown): WidgetPref[] {
  const known = new Set<string>(DEFAULT_WIDGETS.map((w) => w.id));
  const seen = new Set<string>();
  const kept: WidgetPref[] = [];
  if (Array.isArray(raw)) {
    for (const w of raw) {
      const id = (w as WidgetPref | null)?.id;
      if (typeof id === "string" && known.has(id) && !seen.has(id)) { seen.add(id); kept.push({ id: id as WidgetId, hidden: !!(w as WidgetPref).hidden }); }
    }
  }
  if (seen.has("calendar")) return [...kept, ...DEFAULT_WIDGETS.filter((w) => !seen.has(w.id))];
  const merged = [...kept, ...LEGACY_DEFAULT_WIDGETS.filter((w) => !seen.has(w.id))];
  if (sameLayout(merged, LEGACY_DEFAULT_WIDGETS)) return DEFAULT_WIDGETS.map((w) => ({ ...w }));
  return [{ id: "calendar", hidden: false }, ...merged];
}

