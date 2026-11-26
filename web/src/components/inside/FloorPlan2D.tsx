"use client";

import { centroid, type Interior, type Pt } from "@/lib/data/interiors";
import { FLOOR, SELECTED } from "./colors";
import { labelText } from "./labels";

/**
 * A flat plan of one floor: the fallback where WebGL is missing, and the "Plan" view. The room list beside it is the
 * keyboard and screen reader route; this drawing is a picture with tap targets.
 */
export function FloorPlan2D({ interior, level, selected, onSelect, dark }: { interior: Interior; level: number; selected: string | null; onSelect: (id: string) => void; dark: boolean }) {
  const lv = interior.levels[level];
  const xs = interior.footprint.map((p) => p[0]);
  const zs = interior.footprint.map((p) => p[1]);
  const pad = 4;
  const [x0, x1, z0, z1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad + 3];
  const path = (pts: Pt[], holes: Pt[][] = []) =>
    [pts, ...holes].map((ring) => `M${ring.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join("L")}Z`).join(" ");
  const ink = dark ? "#e8efe6" : "#1d2a22";
  const crowded = lv.spaces.filter((s) => s.walled).length > 16;
  return (
    <svg viewBox={`${x0} ${z0} ${x1 - x0} ${z1 - z0}`} className="h-full w-full" role="img" aria-label={`Floor plan of ${interior.name}, ${lv.label}`}>
      <path d={path(interior.footprint, lv.holes)} fill={dark ? "#26302a" : "#ddd6c8"} fillRule="evenodd" stroke={ink} strokeOpacity={0.35} strokeWidth={0.4} />
      {lv.spaces.map((s) => (
        <path
          key={s.id}
          d={path(s.shape, s.holes)}
          fillRule="evenodd"
          fill={s.id === selected ? SELECTED : FLOOR[s.kind]}
          fillOpacity={dark && s.id !== selected ? 0.55 : 1}
          stroke={ink}
          strokeOpacity={s.walled ? 0.7 : 0.15}
          strokeWidth={s.walled ? 0.22 : 0.1}
          onClick={() => onSelect(s.id)}
          style={{ cursor: "pointer" }}
        />
      ))}
      {lv.spaces
        .filter((s) => !s.minor && s.kind !== "corridor" && (!crowded || !s.walled || s.id === selected))
        .map((s) => {
          const [x, z] = centroid(s.shape);
          return (
            <text key={s.id} x={x} y={z} textAnchor="middle" dominantBaseline="middle" fontSize={s.walled ? 1.5 : 1.3} fontWeight={s.walled ? 700 : 500} fill={ink} style={{ pointerEvents: "none" }}>
              {labelText(s)}
            </text>
          );
        })}
      <text x={0} y={Math.max(...zs) + 3.2} textAnchor="middle" fontSize={1.4} fontWeight={700} fill={ink} opacity={0.7}>
        FRONT
      </text>
    </svg>
  );
}
