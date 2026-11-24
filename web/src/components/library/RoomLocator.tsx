"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { CampusCanvas, type CanvasHandle } from "@/components/map/CampusCanvas";
import { PLACE_BY_ID, placeCenter, placeRadius, type PlaceKind } from "@/lib/data/campus";
import { floorPlan } from "@/lib/library/plan";
import { LIBRARY_ROOM_BY_ID, whereIs, type LibraryRoom } from "@/lib/library/rooms";

const ALL_KINDS = new Set<PlaceKind>(["teaching", "residence", "sports", "food", "landmark"]);

/**
 * The map that pulls out while booking: where block A3 is on campus, and where the room sits on its floor.
 * Mount it only while it is on screen. The campus map is a live canvas.
 */
export function RoomLocator({ roomId }: { roomId: string }) {
  const room = LIBRARY_ROOM_BY_ID[roomId];
  const canvas = useRef<CanvasHandle>(null);
  const place = PLACE_BY_ID.A3;
  const pins = useMemo(() => [{ id: "sel", place: "A3", at: placeCenter(place), label: "L", tone: "accent" as const }], [place]);

  // let the canvas measure itself, then glide to block A3
  useEffect(() => {
    const t = setTimeout(() => canvas.current?.focus(placeCenter(place), Math.max(placeRadius(place), 22) * 1.15), 380);
    return () => clearTimeout(t);
  }, [place]);

  if (!room) return null;
  return (
    <div className="space-y-3" aria-label={`Where ${room.id} is`}>
      <div>
        <p className="t-eyebrow mb-1.5">On campus</p>
        <div className="relative h-[190px] overflow-hidden rounded-2xl ring-1 ring-sep">
          <CampusCanvas ref={canvas} selected="A3" kinds={ALL_KINDS} pins={pins} inset={{}} onSelect={() => {}} />
          <span className="glass pointer-events-none absolute left-2 top-2 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold"><MapPin size={12} className="mr-1 inline" />Block A3 Library</span>
        </div>
      </div>
      <FloorPlanFigure room={room} />
      <Link href={`/hub?section=map&focus=${room.id}`} className="press inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-accent">Open the full campus map <ArrowRight size={15} /></Link>
    </div>
  );
}

/** A schematic of the room's floor with its wing and room lit up. Not to scale. */
export function FloorPlanFigure({ room }: { room: LibraryRoom }) {
  const plan = useMemo(() => floorPlan(room.level), [room.level]);
  const sameWing = new Set(Object.values(LIBRARY_ROOM_BY_ID).filter((r) => r.level === room.level && r.wing === room.wing).map((r) => r.id));
  return (
    <figure>
      <p className="t-eyebrow mb-1.5">Level {room.level}, {room.wing} wing</p>
      <svg viewBox={`0 0 ${plan.width} ${plan.height}`} role="img" aria-label={`Schematic floor plan of Level ${room.level}. Room ${room.id} is in the ${room.wing} wing.`} className="h-auto w-full rounded-2xl bg-surface ring-1 ring-sep">
        <rect x={6} y={6} width={plan.width - 12} height={plan.height - 12} rx={10} fill="none" stroke="var(--sep)" strokeWidth={1.5} />
        <rect x={plan.commons.x} y={plan.commons.y} width={plan.commons.w} height={plan.commons.h} rx={8} fill="var(--surface-2)" stroke="var(--sep)" />
        <text x={plan.commons.x + plan.commons.w / 2} y={plan.commons.y + plan.commons.h / 2 + 3} textAnchor="middle" fontSize={11} fill="var(--label-3)">{plan.commons.label}</text>
        {plan.rooms.map((r) => {
          const mine = r.id === room.id;
          const near = sameWing.has(r.id);
          return (
            <g key={r.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={mine ? "var(--accent)" : near ? "var(--accent-soft)" : "var(--surface-3)"} stroke={mine ? "var(--accent)" : "var(--sep)"} strokeWidth={mine ? 1.5 : 0.75} />
              {mine && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 3.5} textAnchor="middle" fontSize={r.w > 40 ? 11 : 8} fontWeight={700} fill="var(--accent-fg)">{r.id.startsWith("SSR") ? r.id : r.id}</text>}
            </g>
          );
        })}
        {plan.wings.map((w) => (
          <text key={w.wing + w.label} x={w.x} y={w.y} textAnchor="middle" fontSize={9.5} fontWeight={w.wing === room.wing ? 700 : 500} fill={w.wing === room.wing ? "var(--accent)" : "var(--label-3)"}>{w.label}</text>
        ))}
      </svg>
      <figcaption className="t-caption mt-1.5">Schematic floor plan, not to scale. The real layout may differ. {whereIs(room)}.</figcaption>
    </figure>
  );
}
