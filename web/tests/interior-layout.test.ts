import assert from "node:assert/strict";
import test from "node:test";
import { DOOR_W, furnish, roomWalls, stairSteps, WALL_H } from "../src/components/inside/layout.ts";
import { findSpace, INTERIORS, inside, type Space } from "../src/lib/data/interiors.ts";

const room = (code: string, place?: string): Space => findSpace(code, place)!.space;
const length = (w: { a: [number, number]; b: [number, number] }) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
const perimeter = (s: Space) => s.shape.reduce((sum, p, i) => sum + Math.hypot(s.shape[(i + 1) % s.shape.length][0] - p[0], s.shape[(i + 1) % s.shape.length][1] - p[1]), 0);

test("a classroom's walls run round it with one door gap", () => {
  const g05 = room("A4-G05");
  const walls = roomWalls(g05);
  assert.equal(walls.length, g05.shape.length + 1, "the door edge is split in two");
  const built = walls.reduce((sum, w) => sum + length(w), 0);
  assert.ok(Math.abs(perimeter(g05) - built - DOOR_W) < 0.5, `about ${DOOR_W} m left open (built ${built.toFixed(1)} of ${perimeter(g05).toFixed(1)} m)`);
  assert.ok(walls.every((w) => w.h === WALL_H));
});

test("an open study room has no wall on its door side, and open areas have none at all", () => {
  const s221 = room("S221", "A3");
  assert.ok(s221.openFront);
  assert.equal(roomWalls(s221).length, s221.shape.length - 1);
  const courtyard = INTERIORS.find((i) => i.place === "A5")!.levels[1].spaces.find((s) => s.kind === "porch")!;
  assert.deepEqual(roomWalls(courtyard), []);
});

test("furniture stays inside its room, and every classroom gets desks", () => {
  for (const interior of INTERIORS) {
    for (const level of interior.levels) {
      for (const space of level.spaces) {
        const pieces = furnish(space);
        if (space.kind === "classroom") assert.ok(pieces.some((p) => p.part === "desk"), `${space.id} has desks`);
        for (const p of pieces) assert.ok(inside(space.shape, [p.x, p.z], 0.05), `${interior.place} ${space.id}: ${p.part} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
      }
    }
  }
});

test("stairs climb to the next floor", () => {
  const stairs = INTERIORS.flatMap((i) => i.levels.flatMap((l) => l.spaces)).find((s) => s.kind === "stairs")!;
  const steps = stairSteps(stairs);
  assert.ok(steps.length >= 4);
  assert.ok(Math.abs(steps.at(-1)!.h - WALL_H) < 1e-9);
  assert.ok(steps.every((s, i) => i === 0 || s.h > steps[i - 1].h));
});
