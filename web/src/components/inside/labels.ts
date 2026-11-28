import type { Space } from "../../lib/data/interiors.ts";

/** Short text for a space's label: its number without the block (G03, N201, 103), or its name. */
export function labelText(space: Space): string {
  if (space.code) return space.code.replace(/^A\d-/, "");
  return space.label ?? space.name;
}
