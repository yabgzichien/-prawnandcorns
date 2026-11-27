import type { BrowserContext } from "@playwright/test";

/**
 * Today now starts as the master calendar alone, and every other card is switched on in Customise.
 * This writes the layout the older specs were written against before the first page loads: the six classic cards, plus Heads-up and My plans,
 * with the master calendar off. It does not overwrite a layout the test saved itself.
 */
export async function showTodayCards(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      const key = "xmum-compass:v1";
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (saved.widgets) return;
      saved.widgets = [
        { id: "calendar", hidden: true },
        ...["next", "alerts", "due", "today", "clubs", "find"].map((id) => ({ id, hidden: false })),
        { id: "fees", hidden: true }, { id: "progress", hidden: true },
        { id: "headsup", hidden: false }, { id: "plans", hidden: false },
      ];
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {}
  });
}
