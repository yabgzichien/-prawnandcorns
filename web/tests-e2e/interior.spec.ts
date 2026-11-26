import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

/**
 * The building interiors (UX-ADR-003): opened from a room on the campus map, with the ground floor classrooms G01 to
 * G12 listed three to a corner, floors and buildings switchable, a flat plan, and Escape back to the map.
 */
test("view a room inside its block from the map, switch floor and building, then go back with Escape", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/hub?section=map", { waitUntil: "networkidle" });

  await page.getByRole("textbox", { name: "Search campus" }).fill("A2-G05");
  await page.getByRole("button", { name: /A2-G05/ }).first().click();
  const open = page.getByRole("button", { name: "View A2-G05 inside" });
  await open.click();

  const viewer = page.getByRole("region", { name: "Inside Block A2" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Back to the campus map" })).toBeFocused();
  await expect(viewer.getByText("A2-G05, Classroom G05")).toBeVisible();

  const rooms = viewer.getByRole("list", { name: "Rooms on this floor" });
  await expect(rooms.getByRole("listitem")).toHaveCount(12);
  const codes = await rooms.getByRole("button").evaluateAll((els) => els.map((el) => el.querySelector("span span")?.textContent));
  expect(codes).toEqual(Array.from({ length: 12 }, (_, i) => `A2-G${String(i + 1).padStart(2, "0")}`));

  await viewer.getByRole("button", { name: /^Level 1/ }).click();
  await expect(viewer.getByRole("button", { name: /^Level 1/ })).toHaveAttribute("aria-pressed", "true");
  await expect(rooms.getByRole("button").first()).toContainText("A2-101");
  await expect(viewer.getByText(/Not confirmed|not confirmed/).first()).toBeVisible();

  await viewer.getByRole("button", { name: "Block A3" }).click();
  const a3 = page.getByRole("region", { name: "Inside Block A3" });
  await a3.getByRole("button", { name: /^Level 2/ }).click();
  await a3.getByRole("button", { name: /^N205/ }).click();
  await expect(a3.getByRole("link", { name: "Book N205" })).toHaveAttribute("href", "/hub?section=library&room=N205");

  // the flat plan: one tap in a browser with WebGL, already showing in one without
  const plan = a3.getByRole("button", { name: "Plan", exact: true });
  if (await plan.count()) await plan.click();
  await expect(a3.getByRole("img", { name: "Floor plan of Block A3, Level 2" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(a3).toBeHidden();
  await expect(open).toBeFocused();
  expect(errors).toEqual([]);
});

test("the cafeterias, opened straight from a link: D6 has three levels of stalls, LY3 has nine on Level 1", async ({ page }) => {
  // opening from ?inside= renders the viewer on the server too, so this also guards against a hydration mismatch
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/hub?section=map&inside=CANTEEN", { waitUntil: "networkidle" });
  const d6 = page.getByRole("region", { name: /^Inside D6/ });
  await expect(d6).toBeVisible();
  const rooms = d6.getByRole("list", { name: "Rooms on this floor" });
  for (const [floor, stalls] of [[/^Ground floor/, 5], [/^Level 1/, 5], [/^Level 2/, 7]] as const) {
    await d6.getByRole("button", { name: floor }).click();
    await expect(rooms.getByRole("listitem")).toHaveCount(stalls);
  }
  await d6.getByRole("button", { name: "LY3 Cafeteria" }).click();
  const ly3 = page.getByRole("region", { name: "Inside LY3 Cafeteria" });
  await ly3.getByRole("button", { name: /^Level 1/ }).click();
  await expect(ly3.getByRole("list", { name: "Rooms on this floor" }).getByRole("listitem")).toHaveCount(9);
  expect(errors).toEqual([]);
});
