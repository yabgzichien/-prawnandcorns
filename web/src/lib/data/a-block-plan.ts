/**
 * The plan of A1, A2, A4 and A5, shared by the 3D exterior (components/map3d/buildings.tsx) and the interiors
 * (lib/data/interiors.ts), so the rooms inside follow the same courtyard the roofs are drawn round.
 *
 * Shares of the walls' half width `s` (Ben's photos; all four blocks alike): a corner tower `tower` wide at each
 * corner, a gable on each side `gable` wide each way from the middle, and round each corner a red roof that rises from
 * its eaves (where the gables start) to its ridge, `ridge` out from the corner. The courtyard's points stop `point`
 * inside the walls, and a darker square `square` each way from the middle (satellite photo) is set in its paving.
 */
export const GABLE_PLAN = { tower: 0.26, gable: 0.54, ridge: 0.95, point: 0.06, square: 0.13 };

/** A point on the courtyard's outline (local units), with the normal there into the courtyard. */
export type CourtPoint = { x: number; z: number; nx: number; nz: number };

/**
 * The open courtyard in the middle of A1, A2, A4 and A5 (Ben: open to the sky, down to the ground; aerial and
 * satellite photos), in plan: the square less a circle `R` round each corner (under the red roofs' ridges), a
 * four-pointed star whose points reach behind the gables and stop `m` inside the walls. One arc round each corner;
 * a short straight run joins each arc to the next, behind a gable.
 */
export function courtyardArcs(s: number, R: number, m: number): CourtPoint[][] {
  const t0 = Math.asin(m / R);
  const quarter = Array.from({ length: 13 }, (_, i) => {
    const t = t0 + ((Math.PI / 2 - 2 * t0) * i) / 12;
    return { x: s - R * Math.cos(t), z: s - R * Math.sin(t), nx: -Math.cos(t), nz: -Math.sin(t) };
  });
  // the same round the other three corners, each turned a quarter on from the last
  return [0, 1, 2, 3].map((q) =>
    quarter.map((p) => {
      let { x, z, nx, nz } = p;
      for (let k = 0; k < q; k++) [x, z, nx, nz] = [z, -x, nz, -nx];
      return { x, z, nx, nz };
    }),
  );
}
