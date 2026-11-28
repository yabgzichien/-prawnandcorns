import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIRMED_INTERIOR_ROOMS,
  edgeDistance,
  findSpace,
  hasInterior,
  INTERIOR_BY_PLACE,
  INTERIORS,
  inside,
  polygonArea,
  type Pt,
  type Space,
} from "../src/lib/data/interiors.ts";
import { LIBRARY_ROOMS } from "../src/lib/library/rooms.ts";
import { ROOM_BY_CODE, searchCampus } from "../src/lib/data/campus.ts";

/** Sutherland-Hodgman: the part of `subject` inside the convex polygon `clip`. */
function clipPolygon(subject: Pt[], clip: Pt[]): Pt[] {
  const sign = Math.sign(signedArea(clip)) || 1;
  const isIn = (p: Pt, a: Pt, b: Pt) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9;
  const cross = (p: Pt, q: Pt, a: Pt, b: Pt): Pt => {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = [p[0], p[1], q[0], q[1], a[0], a[1], b[0], b[1]];
    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4) || 1e-12;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      if (isIn(q, a, b)) {
        if (!isIn(p, a, b)) out.push(cross(p, q, a, b));
        out.push(q);
      } else if (isIn(p, a, b)) out.push(cross(p, q, a, b));
    }
  }
  return out;
}
function signedArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
  return a / 2;
}
const overlap = (a: Pt[], b: Pt[]) => {
  const c = clipPolygon(a, b);
  return c.length < 3 ? 0 : polygonArea(c);
};
function convex(p: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const [a, b, c] = [p[i], p[(i + 1) % p.length], p[(i + 2) % p.length]];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

test("every A block floor comes from a posted plan", () => {
  for (const place of ["A1", "A2", "A4", "A5"]) {
    const levels = INTERIOR_BY_PLACE[place].levels;
    assert.deepEqual(levels.map((l) => l.short), ["G", "1", "2", "3", "4", "5"], place);
    for (const level of levels) {
      assert.ok(!level.spaces.some((s) => s.kind === "courtyard"), `${place} ${level.label} has no generic courtyard`);
      assert.ok(level.note?.includes("evacuation plan"), `${place} ${level.label}`);
    }
  }
});

test("A5 follows its posted plans and keeps the computing and electronics labs", () => {
  for (const [code, level] of [["A5-L1", 1], ["A5-L2", 1], ["A5-L3", 2]] as const) assert.equal(findSpace(code)?.level, level, code);
  const names = INTERIOR_BY_PLACE.A5.levels.flatMap((l) => l.spaces.map((s) => s.name));
  for (const name of ["Marine Study Lab", "Processing Lab", "Aquatic Breeding Room", "Cold water pump room"]) assert.ok(names.includes(name), name);
  assert.equal(INTERIOR_BY_PLACE.A5.levels[1].spaces.filter((s) => s.kind === "porch").length, 4);
  assert.ok(INTERIOR_BY_PLACE.A5.levels.slice(2).every((l) => !l.spaces.some((s) => s.kind === "porch")));
});

test("A1's ground floor follows its posted plan, not the generic classrooms", () => {
  const ground = INTERIOR_BY_PLACE.A1.levels[0];
  const names = ground.spaces.map((s) => s.name);
  for (const name of ["Central Machine Room", "Computer Centre", "Lecture Hall", "Lift lobby", "Classroom, north", "Auditorium"]) assert.ok(names.includes(name), name);
  assert.equal(ground.spaces.filter((s) => s.name.startsWith("Dressing")).length, 0, "the auditorium is one block");
  assert.ok(!ground.spaces.some((s) => s.code), "the plan shows no room numbers");
  assert.equal(findSpace("A1-G01"), null);
  assert.equal(findSpace("A1-102")?.level, 1);
});

test("A1's Level 1 follows the posted plan and keeps the classroom numbers", () => {
  const first = INTERIOR_BY_PLACE.A1.levels[1];
  assert.deepEqual(first.spaces.filter((s) => s.kind === "classroom").map((s) => s.code).sort(), ["A1-101", "A1-102", "A1-103", "A1-104"]);
  assert.ok(first.spaces.some((s) => s.name === "Meeting Room"));
  assert.equal(first.spaces.filter((s) => s.name.startsWith("Office")).length, 8);
  assert.equal(first.spaces.filter((s) => s.kind === "porch").length, 4, "a porch on each side");
  assert.equal(findSpace("A1-105"), null);
});

test("A1's Levels 2 to 5 follow the posted plan, without porches", () => {
  const levels = INTERIOR_BY_PLACE.A1.levels;
  assert.equal(levels.length, 6);
  for (const level of levels.slice(2)) {
    assert.ok(!level.spaces.some((s) => s.kind === "porch"), level.label);
    assert.equal(level.spaces.filter((s) => s.kind === "stairs").length, 2, level.label);
  }
  const codes = (i: number) => levels[i].spaces.filter((s) => s.kind === "classroom").map((s) => s.code).sort();
  assert.deepEqual(codes(2), ["A1-201", "A1-202", "A1-203", "A1-210"]);
  assert.deepEqual(codes(3), ["A1-301", "A1-302", "A1-303", "A1-304"]);
  assert.deepEqual(codes(4), ["A1-401", "A1-402", "A1-403", "A1-404"]);
  assert.deepEqual(codes(5), []);
  assert.equal(findSpace("A1-210")?.level, 2);
});

test("A2 follows its posted plans and keeps the demo timetable's rooms", () => {
  const levels = INTERIOR_BY_PLACE.A2.levels;
  assert.equal(levels.length, 6);
  const names = levels[0].spaces.map((s) => s.name);
  for (const name of ["Lecture Hall, back", "Lecture Hall, front", "Lift lobby", "Stairs"]) assert.ok(names.includes(name), name);
  assert.equal(findSpace("A2-G05"), null);
  assert.equal(levels[1].spaces.filter((s) => s.kind === "porch").length, 4);
  assert.ok(levels.slice(2).every((l) => !l.spaces.some((s) => s.kind === "porch")));
  for (const [code, level] of [["A2-104", 1], ["A2-203", 2], ["A2-305", 3]] as const) assert.equal(findSpace(code)?.level, level, code);
});

test("A4 follows its posted plans and keeps the event venues and demo rooms", () => {
  const levels = INTERIOR_BY_PLACE.A4.levels;
  assert.equal(levels.length, 6);
  for (const code of ["A4-G05", "A4-G06", "A4-G07", "A4-G08", "A4-G09", "A4-G10"]) assert.equal(findSpace(code)?.space.kind, "classroom", code);
  assert.equal(findSpace("A4-105")?.level, 1);
  assert.equal(findSpace("A4-301")?.level, 3);
  assert.ok(levels[5].spaces.some((s) => s.name === "Cold water pump room"));
  assert.ok(levels.slice(2).every((l) => !l.spaces.some((s) => s.kind === "porch")));
});

test("A3 has no G01 to G12 classrooms; its ground floor follows the campus map", () => {
  const a3 = INTERIOR_BY_PLACE.A3;
  const codes = a3.levels.flatMap((l) => l.spaces.map((s) => s.code ?? ""));
  assert.ok(!codes.some((c) => /^A3-G\d\d$/.test(c)));
  const g = a3.levels[0].spaces.map((s) => s.name);
  assert.ok(g.includes("Student Recruitment Office") && g.includes("ZUS Coffee") && g.includes("A3 Common Space"));
  assert.equal(findSpace("A3-103")?.space.name, "IT Office");
  assert.equal(findSpace("A3-103")?.interior.levels[findSpace("A3-103")!.level].short, "1");
});

test("the demo timetable's room codes are unchanged", () => {
  assert.equal(ROOM_BY_CODE["A3-G01"].name, "Lecture Hall G01");
  assert.equal(ROOM_BY_CODE["A2-305"].name, "Seminar Room 305");
});

test("every space lies inside its building, and walled rooms are convex", () => {
  for (const interior of INTERIORS) {
    for (const level of interior.levels) {
      for (const space of level.spaces) {
        for (const p of space.shape) assert.ok(inside(level.footprint ?? interior.footprint, p, 0.05), `${interior.place} ${level.short} ${space.id} at ${p}`);
        if (space.walled) assert.ok(convex(space.shape), `${space.id} is convex`);
        assert.ok(polygonArea(space.shape) > 1, `${space.id} has an area`);
      }
    }
  }
});

test("no two rooms on a level overlap, and no area covers a room", () => {
  for (const interior of INTERIORS) {
    for (const level of interior.levels) {
      const walled = level.spaces.filter((s) => s.walled);
      for (let i = 0; i < walled.length; i++) {
        for (let j = i + 1; j < walled.length; j++) {
          const o = overlap(walled[i].shape, walled[j].shape);
          assert.ok(o < 0.05, `${interior.place} ${level.short}: ${walled[i].id} and ${walled[j].id} overlap by ${o.toFixed(2)} m2`);
        }
      }
      const open = level.spaces.filter((s) => !s.walled);
      for (const a of open) {
        for (const r of walled) {
          const o = overlap(a.shape, r.shape);
          assert.ok(o < 0.5, `${interior.place} ${level.short}: ${a.id} covers ${r.id} by ${o.toFixed(2)} m2`);
        }
      }
    }
  }
});

test("open areas on a level do not stack on each other (except where one is cut out of the other)", () => {
  for (const interior of INTERIORS) {
    for (const level of interior.levels) {
      const open = level.spaces.filter((s) => !s.walled);
      for (let i = 0; i < open.length; i++) {
        for (let j = i + 1; j < open.length; j++) {
          const [a, b] = [open[i], open[j]];
          // a hole cut for the other (stairs in a hall) or for the atrium makes it fine
          const cut = (x: Space, y: Space) => (x.holes ?? []).some((h) => overlap(h, y.shape) > 0.5 * polygonArea(y.shape));
          if (cut(a, b) || cut(b, a)) continue;
          if (!convex(b.shape) && !convex(a.shape)) continue; // the clip needs one convex outline
          const o = convex(b.shape) ? overlap(a.shape, b.shape) : overlap(b.shape, a.shape);
          assert.ok(o < 0.5, `${interior.place} ${level.short}: ${a.id} and ${b.id} overlap by ${o.toFixed(2)} m2`);
        }
      }
    }
  }
});

test("every door is on its room's outline", () => {
  for (const interior of INTERIORS) {
    for (const level of interior.levels) {
      for (const space of level.spaces.filter((s) => s.walled)) {
        assert.ok(space.door, `${space.id} has a door`);
        assert.ok(edgeDistance(space.shape, space.door!) < 0.05, `${space.id}'s door is on its outline`);
      }
    }
  }
});

test("all 43 library rooms are in A3, on their level and wing", () => {
  for (const r of LIBRARY_ROOMS) {
    const hit = findSpace(r.id, "A3");
    assert.ok(hit, `${r.id} is placed`);
    assert.equal(hit!.interior.levels[hit!.level].short, String(r.level), `${r.id} level`);
    assert.equal(hit!.space.wing, r.wing, `${r.id} wing`);
    assert.equal(hit!.space.seats, r.capacity);
  }
  const a3 = INTERIOR_BY_PLACE.A3;
  const c = (x: number) => ({ N: -1, S: 1 })[x === 0 ? "N" : "S"];
  // silent rooms on the north (lake) side, open study rooms on the south (statue) side
  for (const r of LIBRARY_ROOMS.filter((x) => x.wing === "North" || x.wing === "South")) {
    const s = findSpace(r.id, "A3")!.space;
    const z = s.shape.reduce((sum, p) => sum + p[1], 0) / s.shape.length;
    assert.equal(Math.sign(z), c(r.wing === "North" ? 0 : 1), r.id);
  }
  assert.ok(a3.levels.find((l) => l.short === "2")!.spaces.some((s) => s.name === "Circulation Counter"));
  assert.ok(a3.levels.find((l) => l.short === "3")!.holes.length > 0, "the atrium is open on level 3");
});

test("D6 has 4, 5 and 7 stalls on its three levels plus a convenience store; LY3 has 9 stalls and a mart", () => {
  const d6 = INTERIOR_BY_PLACE.CANTEEN;
  assert.deepEqual(d6.levels.map((l) => l.short), ["G", "1", "2"]);
  const stalls = d6.levels.map((l) => l.spaces.filter((s) => s.kind === "food" && s.walled).length);
  assert.deepEqual(stalls, [4, 5, 7]);
  assert.equal(d6.levels.flatMap((l) => l.spaces).filter((s) => s.kind === "shop").length, 1);
  assert.equal(stalls.reduce((a, b) => a + b, 0) + 1, 17, "17 lots including the convenience store");
  const ly3 = INTERIOR_BY_PLACE.LY3;
  assert.equal(ly3.levels[1].spaces.filter((s) => s.kind === "food" && s.walled).length, 9);
  assert.ok(ly3.levels[0].spaces.some((s) => s.name === "Unmanned Mart"));
});

test("the confirmed classrooms are searchable, and only real places have interiors", () => {
  assert.equal(CONFIRMED_INTERIOR_ROOMS.length, 9);
  for (const r of CONFIRMED_INTERIOR_ROOMS) assert.equal(ROOM_BY_CODE[r.code]?.place, r.place, r.code);
  assert.equal(searchCampus("A4-G07", 1)[0]?.type, "room");
  for (const p of ["A1", "A2", "A3", "A4", "A5", "CANTEEN", "LY3"]) assert.ok(hasInterior(p), p);
  assert.ok(!hasInterior("B1") && !hasInterior(null));
  // ids are unique within each building
  for (const interior of INTERIORS) {
    const ids = interior.levels.flatMap((l) => l.spaces.map((s) => s.id));
    assert.equal(new Set(ids).size, ids.length, `${interior.place} ids`);
  }
});
