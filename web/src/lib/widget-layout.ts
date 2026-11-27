// The Today cards, their default layout and how a saved layout is brought up to date. Pure, so tests can load it.

export type WidgetId = "calendar" | "alerts" | "attention" | "fees" | "progress" | "clubs" | "find" | "plans";
export const WIDGET_SIZES = ["compact", "standard", "wide"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];
export type WidgetPref = { id: WidgetId; hidden: boolean; size?: WidgetSize };

/** Today starts as the master calendar alone. Every other card is one switch away in Customise. */
export const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "calendar", hidden: false },
  { id: "alerts", hidden: true },
  { id: "attention", hidden: true },
  { id: "clubs", hidden: true },
  { id: "find", hidden: true },
  { id: "fees", hidden: true },
  { id: "progress", hidden: true },
  { id: "plans", hidden: true },
];

/** What Today showed before the master calendar existed. A saved layout equal to this was never customised. */
const LEGACY_DEFAULT_WIDGETS = [
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

// Legacy pairs share a destination. Either visible source keeps that destination visible.
export function mergeWidgets(raw: unknown): WidgetPref[] {
  if (!Array.isArray(raw)) return DEFAULT_WIDGETS.slice();
  const saved = new Map<string, boolean>();
  const sizes = new Map<string, WidgetSize>();
  for (const w of raw) {
    if (typeof w?.id !== "string" || saved.has(w.id)) continue;
    saved.set(w.id, !!w.hidden);
    if (WIDGET_SIZES.includes(w.size)) sizes.set(w.id, w.size);
  }
  if (!saved.has("calendar")) {
    for (const w of LEGACY_DEFAULT_WIDGETS) if (!saved.has(w.id)) saved.set(w.id, w.hidden);
    const legacy = [...saved].filter(([id]) => LEGACY_DEFAULT_WIDGETS.some((w) => w.id === id));
    if (!sizes.size && legacy.every(([id, hidden], i) => id === LEGACY_DEFAULT_WIDGETS[i].id && hidden === LEGACY_DEFAULT_WIDGETS[i].hidden)) return DEFAULT_WIDGETS.slice();
  }
  const calendarHidden = !!saved.get("calendar") && saved.get("today") !== false && saved.get("next") !== false;
  const merged = new Map<WidgetId, boolean>([["calendar", calendarHidden]]);
  for (const [oldId, hidden] of saved) {
    const id = oldId === "due" || oldId === "headsup" ? "attention" : oldId;
    const pref = DEFAULT_WIDGETS.find((w) => w.id === id);
    if (!pref || id === "calendar") continue;
    merged.set(pref.id, (merged.get(pref.id) ?? true) && hidden);
  }
  for (const w of DEFAULT_WIDGETS) if (!merged.has(w.id)) merged.set(w.id, w.hidden);
  return [...merged].map(([id, hidden]) => {
    const size = id === "calendar" ? undefined : sizes.get(id);
    return size ? { id, hidden, size } : { id, hidden };
  });
}

export function packWidgets(cards: WidgetPref[], heights: Partial<Record<WidgetId, number>>, gap: number) {
  const placed: { card: WidgetPref; top: number; column: number; span: number; height: number }[] = [];
  for (const card of cards) {
    const span = card.size === "wide" ? 2 : 1;
    const height = heights[card.id] ?? 128;
    const firstSpace = (column: number) => {
      let top = 0;
      for (const other of placed) {
        if (column >= other.column + other.span || column + span <= other.column) continue;
        if (top + height + gap <= other.top) break;
        top = Math.max(top, other.top + other.height + gap);
      }
      return top;
    };
    const left = firstSpace(0);
    const right = span === 1 ? firstSpace(1) : Infinity;
    const column = right < left ? 1 : 0;
    placed.push({ card, top: Math.min(left, right), column, span, height });
    placed.sort((a, b) => a.top - b.top || a.column - b.column);
  }
  return placed;
}
