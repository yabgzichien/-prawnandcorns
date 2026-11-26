"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Box, ExternalLink, Info, Map as MapIcon, Tag, X } from "lucide-react";
import { canUseWebGL } from "@/components/map3d/webgl";
import { ROOM_BY_CODE } from "@/lib/data/campus";
import { CORNER_LABEL, centroid, findSpace, INTERIOR_BY_PLACE, INTERIORS, TOUR_URL, type Space } from "@/lib/data/interiors";
import { LIBRARY_ROOM_BY_ID } from "@/lib/library/rooms";
import { SPRING_FAST, useMediaQuery } from "@/lib/hooks";
import { KIND_LABEL } from "./colors";
import { FloorPlan2D } from "./FloorPlan2D";
import type { Focus } from "./InteriorScene";

// three.js for the inside view loads only when it is opened.
const InteriorScene = dynamic(() => import("./InteriorScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-[0.9rem] font-semibold text-label-2" role="status">
      Loading the building
    </div>
  ),
});

const SHORT_NAME: Record<string, string> = { CANTEEN: "D6", LY3: "LY3" };

/** A space's name as the campus directory knows it, where the directory has it. */
const displayName = (s: Space) => (s.code && ROOM_BY_CODE[s.code]?.name) || s.name;

export type InteriorViewProps = {
  /** A place with an interior (A1 to A5, CANTEEN, LY3). */
  place: string;
  /** A room to open on: its code (A1-G03, N201) or id. */
  room?: string | null;
  dark: boolean;
  onClose: () => void;
};

/** Whether this browser draws WebGL, checked once. False on the server and while hydrating, so both render the same. */
let webglChecked: boolean | null = null;
const noSubscribe = () => () => {};
function useWebGL() {
  return useSyncExternalStore(noSubscribe, () => (webglChecked ??= canUseWebGL()), () => false);
}

/**
 * Inside a building: a 3D view of one floor (or a flat plan), a floor picker, and a list of the floor's rooms. Fills
 * the map's box; the map stays underneath.
 */
export function InteriorView({ place: initialPlace, room, dark, onClose }: InteriorViewProps) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const opening = useMemo(() => (room ? findSpace(room, initialPlace) : null), [room, initialPlace]);
  const [place, setPlace] = useState(initialPlace);
  const interior = INTERIOR_BY_PLACE[place] ?? INTERIORS[0];
  const [level, setLevel] = useState(opening?.level ?? 0);
  const [selected, setSelected] = useState<string | null>(opening?.space.id ?? null);
  const [labels, setLabels] = useState(true);
  const webgl = useWebGL();
  // keyboard focus moves into the viewer when it opens (so Escape and Tab work here) and goes back where it was on close
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    back.current?.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"3d" | "plan">("3d");
  const show3d = webgl && !failed && mode === "3d";
  const lv = interior.levels[level];
  const y = level * interior.storey;
  const [focus, setFocus] = useState<Focus>(() => {
    if (opening) {
      const [x, z] = centroid(opening.space.shape);
      return { x, y: opening.level * opening.interior.storey, z, dist: 52, key: `open-${opening.space.id}` };
    }
    return { x: 0, y: 0, z: 0, keep: true, key: `start-${initialPlace}` };
  });

  const goLevel = useCallback(
    (i: number) => {
      setLevel(i);
      setSelected((sel) => (sel && interior.levels[i].spaces.some((s) => s.id === sel) ? sel : null));
      setFocus((f) => ({ x: f.x, y: i * interior.storey, z: f.z, keep: true, key: `level-${place}-${i}-${Date.now()}` }));
    },
    [interior, place],
  );

  const pick = useCallback(
    (id: string, fly: boolean) => {
      setSelected(id);
      if (!fly) return;
      const s = lv.spaces.find((x) => x.id === id);
      if (!s) return;
      const [x, z] = centroid(s.shape);
      setFocus({ x, y, z, dist: 44, key: `room-${id}-${Date.now()}` });
    },
    [lv, y],
  );

  const switchTo = (p: string) => {
    if (p === place) return;
    setPlace(p);
    setLevel(0);
    setSelected(null);
    setFocus({ x: 0, y: 0, z: 0, keep: true, key: `start-${p}` });
  };

  const sel = selected ? lv.spaces.find((s) => s.id === selected) ?? null : null;
  const rooms = lv.spaces.filter((s) => s.walled && !s.minor);
  const places = lv.spaces.filter((s) => !s.walled && !s.minor && s.kind !== "corridor");
  const libRoom = sel?.code ? LIBRARY_ROOM_BY_ID[sel.code] : undefined;
  const levelsTopDown = interior.levels.map((l, i) => ({ l, i })).reverse();

  const floorPicker = (
    <div role="group" aria-label="Floors" className={desktop ? "glass flex flex-col gap-1 rounded-2xl p-1" : "glass rail flex gap-1 overflow-x-auto rounded-full p-1"}>
      {(desktop ? levelsTopDown : interior.levels.map((l, i) => ({ l, i }))).map(({ l, i }) => (
        <button
          key={l.id}
          onClick={() => goLevel(i)}
          aria-pressed={i === level}
          aria-label={`${l.label}${l.title ? `: ${l.title}` : ""}`}
          title={`${l.label}${l.title ? `: ${l.title}` : ""}`}
          className="press grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-2 text-[0.85rem] font-bold"
          style={{ background: i === level ? "var(--accent)" : "transparent", color: i === level ? "var(--accent-fg)" : "var(--label)" }}
        >
          {l.short}
        </button>
      ))}
    </div>
  );

  return (
    <section
      className="absolute inset-0 z-40 overflow-hidden"
      style={{ background: "var(--bg)" }}
      aria-label={`Inside ${interior.name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {/* the building, in the part of the box the panel leaves free */}
      <div className={`absolute left-0 top-0 ${desktop ? "bottom-0 right-[408px]" : "bottom-[44%] right-0"}`}>
        {show3d ? (
          <InteriorScene
            interior={interior}
            level={level}
            selected={selected}
            focus={focus}
            dark={dark}
            labels={labels}
            onSelect={(id) => pick(id, false)}
            onFail={() => setFailed(true)}
            clipTop={desktop ? 112 : 136}
            inset={desktop ? { left: 72, top: 112 } : { left: 0, top: 136 }}
          />
        ) : (
          <div className={`absolute inset-0 ${desktop ? "pb-4 pl-20 pr-4 pt-[132px]" : "px-3 pb-2 pt-[150px]"}`}>
            <FloorPlan2D interior={interior} level={level} selected={selected} onSelect={(id) => pick(id, false)} dark={dark} />
          </div>
        )}
      </div>

      {/* header: back, name, other buildings */}
      <div className={`pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2 ${desktop ? "right-[408px]" : "right-3"}`}>
        <div className="glass-thick pointer-events-auto flex max-w-[560px] items-center gap-2 rounded-[22px] py-1.5 pl-1.5 pr-3">
          <button ref={back} onClick={onClose} aria-label="Back to the campus map" className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="t-eyebrow">Inside</p>
            <h2 className="truncate text-[1.02rem] font-semibold tracking-[-0.01em]">{interior.name}</h2>
          </div>
        </div>
        <div className="rail pointer-events-auto flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Buildings">
          {INTERIORS.map((i) => (
            <button
              key={i.place}
              onClick={() => switchTo(i.place)}
              aria-pressed={i.place === place}
              aria-label={i.name}
              className="press glass flex min-h-[34px] shrink-0 items-center rounded-full px-3 text-[0.8rem] font-bold"
              style={{ background: i.place === place ? "var(--accent)" : undefined, color: i.place === place ? "var(--accent-fg)" : undefined }}
            >
              {SHORT_NAME[i.place] ?? i.place}
            </button>
          ))}
        </div>
        {!desktop && <div className="pointer-events-auto">{floorPicker}</div>}
      </div>

      {desktop && <div className="absolute left-3 top-[132px] z-10">{floorPicker}</div>}

      {/* view switch and labels */}
      <div className={`absolute z-10 flex gap-1.5 ${desktop ? "bottom-3 left-3" : "bottom-[calc(44%+0.75rem)] left-3"}`}>
        {webgl && !failed && (
          <div role="group" aria-label="View" className="glass flex rounded-full p-0.5">
            {(["3d", "plan"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className="press flex min-h-[34px] items-center gap-1 rounded-full px-3 text-[0.78rem] font-bold" style={{ background: mode === m ? "var(--accent)" : "transparent", color: mode === m ? "var(--accent-fg)" : "var(--label-2)" }}>
                {m === "3d" ? <Box size={14} /> : <MapIcon size={14} />} {m === "3d" ? "3D" : "Plan"}
              </button>
            ))}
          </div>
        )}
        {show3d && (
          <button
            onClick={() => setLabels((v) => !v)}
            aria-pressed={labels}
            className="press glass flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.78rem] font-semibold"
            style={{ background: labels ? "var(--accent)" : undefined, color: labels ? "var(--accent-fg)" : "var(--label-2)" }}
          >
            <Tag size={14} /> Room numbers
          </button>
        )}
      </div>

      {/* the floor's rooms */}
      <aside
        className={`glass-thick absolute z-20 flex flex-col overflow-hidden ${desktop ? "bottom-3 right-3 top-3 w-[392px] rounded-[28px]" : "bottom-3 left-3 right-3 max-h-[44%] rounded-[24px]"}`}
        aria-label={`${lv.label} of ${interior.name}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="t-eyebrow">{lv.label}</p>
          <h3 className="t-headline mt-0.5">{lv.title ?? interior.name}</h3>
          {lv.note && <p className="t-caption mt-1">{lv.note}</p>}

          <AnimatePresence mode="wait" initial={false}>
            {sel && (
              <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING_FAST} className="mt-4 rounded-2xl bg-accent-soft p-3.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="t-eyebrow text-accent">Selected</p>
                    <p className="mt-0.5 font-semibold tracking-[-0.01em]">{sel.code ? `${sel.code}, ${displayName(sel)}` : displayName(sel)}</p>
                    <p className="t-caption">
                      {[KIND_LABEL[sel.kind], lv.label, sel.corner ? `${CORNER_LABEL[sel.corner]} corner` : null, sel.wing ? `${sel.wing} wing` : null, sel.seats ? `${sel.seats} ${sel.seats === 1 ? "seat" : "seats"}` : null].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} aria-label="Clear selection" className="press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3"><X size={14} /></button>
                </div>
                {sel.detail && <p className="t-caption mt-2">{sel.detail}</p>}
                {sel.assumed && <p className="t-caption mt-1 text-orange">Not confirmed yet: placed by pattern, check on site.</p>}
                {libRoom && (
                  <Link href={`/hub?section=library&room=${libRoom.id}`} className="press btn btn-sm btn-primary mt-3">Book {libRoom.id}</Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {rooms.length > 0 && (
            <>
              <p className="t-eyebrow mb-2 mt-5">Rooms on this floor ({rooms.length})</p>
              <ul aria-label="Rooms on this floor" className="overflow-hidden rounded-2xl bg-surface">
                {rooms.map((s) => (
                  <li key={s.id} className="border-b border-sep last:border-0">
                    <button onClick={() => pick(s.id, show3d)} aria-pressed={selected === s.id} className="press-row flex min-h-[48px] w-full items-center gap-3 px-4 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] font-semibold tracking-[-0.01em]">{s.code ?? displayName(s)}</span>
                        <span className="t-caption block truncate">{s.code ? displayName(s) : KIND_LABEL[s.kind]}{s.corner ? `, ${CORNER_LABEL[s.corner]}` : ""}{s.wing ? `, ${s.wing} wing` : ""}</span>
                      </span>
                      {selected === s.id && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {places.length > 0 && (
            <>
              <p className="t-eyebrow mb-2 mt-5">Areas</p>
              <div className="flex flex-wrap gap-1.5">
                {places.map((s) => (
                  <button key={s.id} onClick={() => pick(s.id, show3d)} aria-pressed={selected === s.id} className="press min-h-[34px] rounded-full px-3 text-[0.8rem] font-semibold" style={{ background: selected === s.id ? "var(--accent)" : "var(--surface)", color: selected === s.id ? "var(--accent-fg)" : "var(--label)" }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {rooms.length === 0 && places.length === 0 && <p className="t-caption mt-4">No rooms are mapped on this level yet.</p>}

          <div className="mt-5 rounded-2xl bg-surface p-3.5">
            <p className="flex items-start gap-1.5 text-[0.82rem] font-semibold text-orange"><Info size={15} className="mt-0.5 shrink-0" /> Approximate layout, confirm on arrival</p>
            <p className="t-caption mt-1">{interior.summary} Drawn from: {interior.sources.join("; ")}. Not a surveyed floor plan.</p>
            <a href={TOUR_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-accent underline-offset-2 hover:underline">
              Open the official virtual tour <ExternalLink size={13} />
            </a>
          </div>
          {!webgl || failed ? <p className="t-caption mt-3">3D isn&rsquo;t available in this browser, so this is the flat plan.</p> : null}
          {show3d && <p className="t-caption mt-3">Drag to turn, pinch or scroll to zoom, tap a room to select it. The label FRONT marks the front of the building.</p>}
        </div>
      </aside>

      <p className="sr-only" aria-live="polite">{`${interior.name}, ${lv.label}${lv.title ? `, ${lv.title}` : ""}.${sel ? ` Selected ${sel.code ?? sel.name}.` : ""}`}</p>
    </section>
  );
}
