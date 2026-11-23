"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Building2, Check, Coffee, Compass, Dumbbell, Landmark, Layers, Minus, Plus, Moon, Search, Sun, Sunset, Trees, X } from "lucide-react";
import dynamic from "next/dynamic";
import { CampusCanvas, type CanvasHandle } from "./CampusCanvas";
import { defaultView, viewFor, type Pin3D } from "./Campus3D";
import { canUseWebGL } from "@/components/map3d/webgl";
import type { Mode } from "@/components/map3d/atmosphere";
import { useApp } from "@/lib/state";
import { PLACE_BY_ID, PLACES, ROOMS, ROOM_BY_CODE, findRoom, placeCenter, placeRadius, searchCampus, type PlaceKind, type Room } from "@/lib/data/campus";
import { COURSE_BY_ID } from "@/lib/data/academics";
import { classesOn, TODAY_IDX } from "@/lib/schedule";
import { SPRING, SPRING_FAST, useMediaQuery } from "@/lib/hooks";
import { Pill } from "@/components/ui/kit";

// three.js loads only when the 3D view is opened, so the rest of the app stays light.
const Campus3D = dynamic(() => import("./Campus3D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-[0.9rem] font-semibold text-label-2" role="status">Loading 3D campus…</div>,
});

const KIND_META: Record<PlaceKind, { label: string; icon: typeof Building2; color: string }> = {
  teaching: { label: "Teaching", icon: BookOpen, color: "var(--accent)" },
  residence: { label: "Residence", icon: Building2, color: "var(--purple)" },
  sports: { label: "Sports", icon: Dumbbell, color: "var(--green)" },
  food: { label: "Food", icon: Coffee, color: "var(--orange)" },
  landmark: { label: "Landmarks", icon: Landmark, color: "var(--teal)" },
};
const NEXT_MODE: Record<Mode, Mode> = { day: "sunset", sunset: "night", night: "day" };
const ALL_KINDS = Object.keys(KIND_META) as PlaceKind[];

const floorOrder = (f: string) => (f === "Ground" ? 0 : f === "Outdoor" ? 0 : Number(f.replace(/\D/g, "")) || 0);

export function MapView() {
  const params = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const canvas = useRef<CanvasHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [query, setQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [kinds, setKinds] = useState<Set<PlaceKind>>(new Set(ALL_KINDS));
  const [showRoute, setShowRoute] = useState(true);
  const { showToast, theme } = useApp();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [view, setView] = useState<"2d" | "3d">(params.get("view") === "3d" ? "3d" : "2d");
  const [visited3d, setVisited3d] = useState(params.get("view") === "3d");
  const [mode3d, setMode3d] = useState<Mode | null>(["day", "sunset", "night"].includes(params.get("mode") ?? "") ? (params.get("mode") as Mode) : null);
  const [names3d, setNames3d] = useState(false);
  const [flyNonce, setFlyNonce] = useState(0);
  const mode: Mode = mode3d ?? (theme === "dark" || (theme === "system" && prefersDark) ? "night" : "day");

  const viewRef = useRef<"2d" | "3d">("2d");
  useEffect(() => { viewRef.current = view; }, [view]);

  // ?cam=LY3 or ?cam=LY3:1.8:30 (place : distance scale : turn in degrees) opens the 3D map looking at a place
  const camParam = useMemo(() => {
    const raw = params.get("cam");
    if (!raw) return undefined;
    const [id, sc, az] = raw.split(":");
    const p = PLACE_BY_ID[id];
    return p ? viewFor(p, Number(sc) || 1, Number(az) || 0) : undefined;
  }, [params]);

  // a deep link (?focus= / ?q=) opened straight into 3D starts already looking at its place
  const deepView = useMemo(() => {
    const code = params.get("focus") ?? params.get("q");
    if (!code) return undefined;
    const r = findRoom(code);
    const id = r?.place ?? searchCampus(code, 1)[0]?.place.id;
    return id ? viewFor(PLACE_BY_ID[id]) : undefined;
  }, [params]);

  const inset = useCallback(() => (desktop ? { right: 400, bottom: 0 } : { right: 0, bottom: 300 }), [desktop]);

  // returning to 2D remounts the SVG map at the whole-campus fit: look at the current selection again
  useEffect(() => {
    if (view !== "2d" || !selected) return;
    const t = setTimeout(() => { const p = PLACE_BY_ID[selected]; canvas.current?.focus(placeCenter(p), Math.max(placeRadius(p), 22), inset()); }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const choose = useCallback((placeId: string | null, r: Room | null = null, fly = true) => {
    setSelected(placeId);
    setRoom(r);
    if (placeId && fly) {
      const p = PLACE_BY_ID[placeId];
      if (viewRef.current === "2d") canvas.current?.focus(placeCenter(p), Math.max(placeRadius(p), 22), inset());
      else setFlyNonce((n) => n + 1);
    }
  }, [inset]);

  // deep links: /map?focus=A3-G01  or  /map?q=library
  const focusParam = params.get("focus");
  const qParam = params.get("q");
  useEffect(() => {
    const code = focusParam ?? qParam;
    if (!code) return;
    const timer = setTimeout(() => {
      const r = findRoom(code);
      if (r) { choose(r.place, r); return; }
      const hit = searchCampus(code, 1)[0];
      if (hit) choose(hit.place.id, hit.type === "room" ? hit.room : null);
    }, 450); // let the map finish its first fit so the fly-to reads as a deliberate move
    return () => clearTimeout(timer);
  }, [focusParam, qParam, choose]);

  const results = useMemo(() => (query.trim() ? searchCampus(query, 7) : []), [query]);

  const route = useMemo(() => classesOn(TODAY_IDX).filter((c) => c.status !== "cancelled"), []);
  const pins = useMemo(() => {
    const list: { id: string; place: string; at: [number, number]; label: string; tone?: "accent" | "green" | "orange" }[] = [];
    if (showRoute) {
      const seen = new Map<string, string[]>();
      route.forEach((c, i) => {
        const r = ROOM_BY_CODE[c.room];
        if (!r) return;
        seen.set(r.place, [...(seen.get(r.place) ?? []), String(i + 1)]);
      });
      seen.forEach((labels, place) => list.push({ id: "route-" + place, place, at: placeCenter(PLACE_BY_ID[place]), label: labels.join("") === labels[0] ? labels[0] : labels[0], tone: "green" }));
    }
    if (selected) list.push({ id: "sel", place: selected, at: placeCenter(PLACE_BY_ID[selected]), label: room ? room.code.split("-")[1] ?? "•" : "•", tone: "accent" });
    return list;
  }, [route, showRoute, selected, room]);

  const pins3d = useMemo<Pin3D[]>(() => pins.map((p) => ({ id: p.id, place: p.place, label: p.label, tone: p.tone === "green" ? "green" : "accent" })), [pins]);
  const place = selected ? PLACE_BY_ID[selected] : null;
  const rooms = place ? ROOMS.filter((r) => r.place === place.id).sort((a, b) => floorOrder(a.floor) - floorOrder(b.floor)) : [];

  const toggleKind = (k: PlaceKind) => setKinds((s) => { const n = new Set(s); if (n.has(k)) { if (n.size > 1) n.delete(k); } else n.add(k); return n; });

  return (
    <div className="relative h-[calc(100dvh)] overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* The 3D scene is parked (paused, hidden) when you switch back to 2D, not unmounted: it re-opens instantly and its HTML labels never tear down mid-render. */}
      {visited3d && (
        <div className={view === "3d" ? "absolute inset-0" : "hidden"} aria-hidden={view !== "3d"}>
        <Campus3D
          paused={view !== "3d"}
          mode={mode} labels={names3d} selected={selected} pins={pins3d} flyNonce={flyNonce} rightInset={desktop ? 400 : 0}
          initialView={camParam ?? (selected ? viewFor(PLACE_BY_ID[selected]) : deepView) ?? defaultView(desktop)}
          intro={!(camParam || selected || deepView)}
          onSelect={(id) => choose(id, null)}
          onFail={() => { setView("2d"); setVisited3d(false); showToast("3D map isn't available on this device — showing the 2D map"); }}
        />
        </div>
      )}
      {view === "2d" && <CampusCanvas ref={canvas} inset={desktop ? { right: 400, top: 96 } : { bottom: 300, top: 120 }} selected={selected} kinds={kinds} pins={pins} onSelect={(id) => choose(id, null)} />}

      {/* Search + layers */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-col gap-2 lg:right-[412px]">
        <div className="pointer-events-auto relative max-w-[460px]">
          <label className="glass-thick flex items-center gap-2 rounded-full py-1 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-accent">
            <Search size={18} className="text-label-2" />
            <input value={query} onFocus={() => setFocusSearch(true)} onBlur={() => setTimeout(() => setFocusSearch(false), 150)} onChange={(e) => setQuery(e.target.value)} placeholder="Search a room, hall, lab or hostel" aria-label="Search campus" className="min-w-0 flex-1 bg-transparent py-3 text-[1rem] outline-none placeholder:text-label-2" />
            {query && <button aria-label="Clear" onClick={() => setQuery("")} className="press grid h-9 w-9 place-items-center rounded-full bg-surface-3"><X size={16} /></button>}
          </label>
          <AnimatePresence>
            {focusSearch && results.length > 0 && (
              <motion.ul initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={SPRING_FAST} className="glass-thick absolute inset-x-0 top-[58px] z-20 overflow-hidden rounded-3xl p-1.5" style={{ transformOrigin: "top left" }}>
                {results.map((h, i) => (
                  <li key={i}>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => { if (h.type === "room") choose(h.place.id, h.room); else choose(h.place.id); setQuery(""); }} className="press-row flex w-full min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${KIND_META[h.place.kind].color} 18%, transparent)`, color: KIND_META[h.place.kind].color }}>{(() => { const I = KIND_META[h.place.kind].icon; return <I size={16} />; })()}</span>
                      <span className="min-w-0"><span className="block truncate text-[0.95rem] font-semibold tracking-[-0.01em]">{h.type === "room" ? `${h.room.code} · ${h.room.name}` : h.place.name}</span><span className="t-caption block truncate">{h.type === "room" ? `${h.place.name} · ${h.room.floor}` : h.place.blurb}</span></span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <div className="rail pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
          <div role="tablist" aria-label="Map view" className="glass flex shrink-0 rounded-full p-0.5">
            {(["2d", "3d"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => { if (v === "3d" && !canUseWebGL()) { showToast("3D needs WebGL2, which this browser doesn't offer"); return; } setView(v); if (v === "3d") { setVisited3d(true); if (selected) setFlyNonce((n) => n + 1); } }} className="press relative min-h-[34px] rounded-full px-3.5 text-[0.8rem] font-bold uppercase tracking-wide" style={{ background: view === v ? "var(--accent)" : "transparent", color: view === v ? "var(--accent-fg)" : "var(--label-2)" }}>{v}</button>
            ))}
          </div>
          {view === "3d" && (
            <>
              <button onClick={() => setNames3d((v) => !v)} aria-pressed={names3d} className="press glass flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold" style={{ opacity: names3d ? 1 : 0.7 }}>{names3d ? "Hide names" : "Show names"}</button>
              <button
                onClick={() => setMode3d(NEXT_MODE[mode])}
                aria-label={`Time of day: ${mode}. Switch to ${NEXT_MODE[mode]}`}
                title={`Time of day: ${mode}`}
                className="press glass grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-full"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={mode} initial={{ opacity: 0, rotate: -60, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 60, scale: 0.5 }} transition={SPRING_FAST} className="grid place-items-center" style={{ color: mode === "day" ? "var(--orange)" : mode === "sunset" ? "var(--red)" : "var(--accent)" }}>
                    {mode === "day" ? <Sun size={18} /> : mode === "sunset" ? <Sunset size={18} /> : <Moon size={18} />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </>
          )}
          {view === "2d" && ALL_KINDS.map((k) => {
            const m = KIND_META[k];
            const on = kinds.has(k);
            return (
              <button key={k} onClick={() => toggleKind(k)} aria-pressed={on} className="press glass flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold" style={{ opacity: on ? 1 : 0.55 }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} /> {m.label}
              </button>
            );
          })}
          <button onClick={() => setShowRoute((v) => !v)} aria-pressed={showRoute} className="press glass flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold" style={{ opacity: showRoute ? 1 : 0.55 }}>
            <Layers size={14} /> My classes today
          </button>
        </div>
      </div>

      {/* Zoom + attribution */}
      {view === "2d" && <div className="absolute bottom-[100px] right-3 z-10 flex flex-col gap-2 lg:bottom-5 lg:left-3 lg:right-auto">
        <div className="glass flex flex-col overflow-hidden rounded-2xl">
          <button aria-label="Zoom in" onClick={() => canvas.current?.zoomBy(1.6)} className="press-row grid h-11 w-11 place-items-center"><Plus size={19} /></button>
          <span className="mx-2 h-px bg-sep" />
          <button aria-label="Zoom out" onClick={() => canvas.current?.zoomBy(1 / 1.6)} className="press-row grid h-11 w-11 place-items-center"><Minus size={19} /></button>
          <span className="mx-2 h-px bg-sep" />
          <button aria-label="Reset view" onClick={() => { choose(null); canvas.current?.reset(); }} className="press-row grid h-11 w-11 place-items-center"><Compass size={18} /></button>
        </div>
      </div>}
      <p className={`glass pointer-events-none absolute bottom-[100px] left-3 z-10 rounded-full px-3 py-1 text-[0.7rem] text-label-2 lg:bottom-5 ${view === "2d" ? "lg:left-[72px]" : "lg:left-3"}`}>Map data © OpenStreetMap contributors · building use &amp; room labels are demo data</p>

      {/* Detail panel — a side card on desktop, a bottom card on phones */}
      <motion.aside
        layout
        className="glass-thick absolute z-20 flex flex-col overflow-hidden rounded-[28px] bottom-[96px] left-3 right-3 max-h-[42dvh] lg:bottom-3 lg:left-auto lg:right-3 lg:top-3 lg:max-h-none lg:w-[384px]"
        aria-label="Place details"
      >
        <AnimatePresence mode="wait" initial={false}>
          {place ? (
            <motion.div key={place.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={SPRING_FAST} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start gap-3 p-5 pb-3">
                <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${KIND_META[place.kind].color} 20%, transparent)`, color: KIND_META[place.kind].color }}>{(() => { const I = KIND_META[place.kind].icon; return <I size={21} />; })()}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="t-headline">{place.name}</h2>
                  <p className="t-sub">{place.blurb}</p>
                  {place.approximate && <p className="t-caption mt-1 text-orange">Approximate — confirm on arrival</p>}
                </div>
                <button aria-label="Close details" onClick={() => choose(null)} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3"><X size={16} /></button>
              </div>

              {room && (
                <div className="mx-5 mb-3 rounded-2xl bg-accent-soft p-3.5">
                  <p className="t-eyebrow text-accent">Selected room</p>
                  <p className="mt-0.5 font-semibold tracking-[-0.01em]">{room.code} · {room.name}</p>
                  <p className="t-caption">{room.floor}{room.seats ? ` · ${room.seats} seats` : ""} · {room.type}</p>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                {place.floors && place.floors > 1 && <FloorStack floors={place.floors} active={room ? floorOrder(room.floor) : null} />}
                {rooms.length > 0 ? (
                  <>
                    <p className="t-eyebrow mb-2 mt-4">Rooms</p>
                    <ul className="overflow-hidden rounded-2xl bg-surface">
                      {rooms.map((r) => (
                        <li key={r.code} className="border-b border-sep last:border-0">
                          <button onClick={() => setRoom(r)} aria-pressed={room?.code === r.code} className="press-row flex w-full min-h-[52px] items-center gap-3 px-4 text-left">
                            <span className="min-w-0 flex-1"><span className="block text-[0.95rem] font-semibold tracking-[-0.01em]">{r.code}</span><span className="t-caption">{r.name} · {r.floor}</span></span>
                            {room?.code === r.code ? <Check size={17} className="text-accent" strokeWidth={3} /> : <Pill tone={r.type === "Lab" ? "purple" : r.type === "Lecture hall" ? "blue" : "teal"}>{r.type}</Pill>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : <p className="t-caption mt-3">No room directory for this place yet.</p>}
              </div>
            </motion.div>
          ) : (
            <motion.div key="home" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={SPRING_FAST} className="flex min-h-0 flex-1 flex-col">
              <div className="p-5 pb-2"><p className="t-eyebrow">Campus</p><h2 className="t-headline mt-0.5">Today&rsquo;s route</h2><p className="t-caption">Tap a numbered pin or a row to fly there.</p></div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                <ol className="overflow-hidden rounded-2xl bg-surface">
                  {route.map((c, i) => {
                    const r = ROOM_BY_CODE[c.room];
                    return (
                      <li key={c.id} className="border-b border-sep last:border-0">
                        <button onClick={() => r && choose(r.place, r)} className="press-row flex w-full min-h-[56px] items-center gap-3 px-4 text-left">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green text-[0.8rem] font-bold" style={{ color: "var(--bg)" }}>{i + 1}</span>
                          <span className="min-w-0 flex-1"><span className="block text-[0.95rem] font-semibold tracking-[-0.01em]">{COURSE_BY_ID[c.courseId].code} · {c.start}</span><span className="t-caption">{c.room}{r ? ` · ${PLACE_BY_ID[r.place].name}` : ""}</span></span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <p className="t-eyebrow mb-2 mt-5">Browse</p>
                <div className="grid grid-cols-2 gap-2">
                  {PLACES.filter((p) => ["A1", "A2", "A3", "A4", "A5", "B1", "CANTEEN", "CAFE", "TRACK", "COURTS"].includes(p.id)).map((p) => (
                    <button key={p.id} onClick={() => choose(p.id)} className="press flex min-h-[48px] items-center gap-2 rounded-xl bg-surface px-3 text-left text-[0.88rem] font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_META[p.kind].color }} /> <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
                <p className="t-caption mt-4 flex items-start gap-1.5"><Trees size={14} className="mt-0.5 shrink-0" /> Pinch or scroll to zoom, drag to pan, double-tap to zoom in.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  );
}

function FloorStack({ floors, active }: { floors: number; active: number | null }) {
  const levels = Array.from({ length: floors }, (_, i) => floors - 1 - i);
  return (
    <div className="mt-1 flex items-end gap-4 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-[3px]" aria-hidden>
        {levels.map((l) => (
          <motion.span key={l} animate={{ background: active === l ? "var(--accent)" : "var(--surface-3)", scaleX: active === l ? 1.12 : 1 }} transition={SPRING} className="block h-[9px] w-24 origin-left rounded-[3px]" />
        ))}
      </div>
      <div className="min-w-0 pb-0.5">
        <p className="t-eyebrow">Floors</p>
        <p className="font-semibold tracking-[-0.01em]">{active === null ? `${floors} levels` : active === 0 ? "Ground floor" : `Level ${active}`}</p>
        <p className="t-caption">{active === null ? "Pick a room to light up its floor" : `of ${floors} levels`}</p>
      </div>
    </div>
  );
}
