"use client";

import { animate, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from "motion/react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BOUNDS, CAMPUS_BOUNDARY, GEO, type EN } from "@/lib/data/campus-geo";
import { PLACES, footprintOf, placeCenter, placeRadius, type Place, type PlaceKind } from "@/lib/data/campus";
import { rubberband } from "@/lib/hooks";

/* World → SVG: x = east (m), y = −north (m). All geometry is in metres; the <g> carries a scale in px/m. */
const P = (ring: readonly EN[] | readonly (readonly number[])[]) => (ring as readonly (readonly number[])[]).map((p) => `${p[0]},${-p[1]}`).join(" ");
const D = (line: readonly (readonly number[])[]) => "M" + (line as readonly (readonly number[])[]).map((p) => `${p[0]} ${-p[1]}`).join("L");

const CORE = { minE: -575, maxE: 125, minN: -120, maxN: 485 }; // the part of campus students actually use
const MIN_PX = 0.35;
const MAX_PX = 10;

const KIND_COLOR: Record<PlaceKind, string> = {
  teaching: "var(--accent)",
  residence: "var(--purple)",
  sports: "var(--green)",
  food: "var(--orange)",
  landmark: "var(--teal)",
};
const fillFor = (k: PlaceKind) => `color-mix(in srgb, ${KIND_COLOR[k]} 26%, var(--map-bldg))`;

const treesPath = (() => {
  const r = 3.2;
  return GEO.trees.map((t) => `M${t[0] - r} ${-t[1]}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`).join("");
})();

const Static = memo(function Static() {
  return (
    <>
      <polygon points={P(CAMPUS_BOUNDARY)} fill="var(--map-ground)" />
      {GEO.park.map((r, i) => <polygon key={"p" + i} points={P(r)} fill="var(--map-grass)" />)}
      {GEO.grass.map((r, i) => <polygon key={"g" + i} points={P(r)} fill="var(--map-grass)" />)}
      {GEO.water.map((r, i) => <polygon key={"w" + i} points={P(r)} fill="var(--map-water)" stroke="color-mix(in srgb, var(--map-water) 70%, var(--label))" strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeOpacity={0.5} />)}
      {GEO.parking.map((r, i) => <polygon key={"k" + i} points={P(r)} fill="var(--map-road)" />)}
      {GEO.roads.map((l, i) => <path key={"r" + i} d={D(l)} fill="none" stroke="var(--map-road)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />)}
      {GEO.paths.map((l, i) => <path key={"f" + i} d={D(l)} fill="none" stroke="var(--map-path)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />)}
      {GEO.hedges.map((l, i) => <path key={"h" + i} d={D(l)} fill="none" stroke="color-mix(in srgb, var(--green) 40%, var(--map-grass))" strokeWidth={1.6} />)}
      {GEO.tracks.map((r, i) => <polygon key={"t" + i} points={P(r)} fill="color-mix(in srgb, var(--red) 38%, var(--map-grass))" />)}
      {GEO.pitches.map((p, i) => <polygon key={"c" + i} points={P(p.ring)} fill={p.sport === "soccer" || p.sport === "" ? "color-mix(in srgb, var(--green) 45%, var(--map-grass))" : "color-mix(in srgb, var(--accent) 30%, var(--map-road))"} stroke="color-mix(in srgb, var(--label) 30%, transparent)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)}
      <path d={treesPath} fill="color-mix(in srgb, var(--green) 55%, var(--map-grass))" opacity={0.85} />
    </>
  );
});

export type CanvasHandle = {
  focus: (center: EN, radius: number, inset?: { right?: number; bottom?: number }) => void;
  zoomBy: (f: number) => void;
  reset: () => void;
};

type Pin = { id: string; place: string; at: EN; label: string; tone?: "accent" | "green" | "orange" };

type Props = {
  selected: string | null;
  kinds: Set<PlaceKind>;
  pins: Pin[];
  /** screen space covered by floating UI, so fit/reset centre in the visible part */
  inset?: { right?: number; bottom?: number; top?: number };
  onSelect: (placeId: string | null) => void;
};

export const CampusCanvas = forwardRef<CanvasHandle, Props>(function CampusCanvas({ selected, kinds, pins, inset, onSelect }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const g = useRef<SVGGElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const insetRef = useRef(inset);
  useEffect(() => { insetRef.current = inset; });
  const touched = useRef(false);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sc = useMotionValue(1);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  const [ready, setReady] = useState(false);
  const [bucket, setBucket] = useState(0);

  const stopAnims = () => { anims.current.forEach((a) => a.stop()); anims.current = []; };

  // The scene transform and world-anchored labels/pins are written straight to the DOM — no React render per frame.
  const paint = useCallback(() => {
    const s = sc.get(), x = tx.get(), y = ty.get();
    g.current?.setAttribute("transform", `matrix(${s} 0 0 ${s} ${x} ${y})`);
    svg.current?.querySelectorAll<SVGGElement>("[data-world]").forEach((el) => {
      const [wx, wy] = el.dataset.world!.split(",").map(Number);
      el.setAttribute("transform", `translate(${wx * s + x} ${wy * s + y})`);
    });
  }, [sc, tx, ty]);
  useMotionValueEvent(tx, "change", paint);
  useMotionValueEvent(ty, "change", paint);
  useMotionValueEvent(sc, "change", (s) => {
    paint();
    const b = s < 0.8 ? 0 : s < 1.6 ? 1 : s < 3.2 ? 2 : 3;
    setBucket((o) => (o === b ? o : b));
  });
  useLayoutEffect(paint); // labels re-mount on state changes; re-apply their transforms

  /** Pan limits at scale s: keep at least 30% of the viewport covered by campus. */
  const bounds = useCallback((s: number) => {
    const { w, h } = size.current;
    const mx = w * 0.3, my = h * 0.3;
    return {
      xMin: mx - BOUNDS.maxE * s, xMax: w - mx - BOUNDS.minE * s,
      yMin: my + BOUNDS.minN * s, yMax: h - my + BOUNDS.maxN * s,
    };
  }, []);

  const springTo = useCallback((x: number, y: number, s: number, duration = 0.7) => {
    stopAnims();
    const cfg = { type: "spring", bounce: 0, duration } as const;
    anims.current = [animate(tx, x, cfg), animate(ty, y, cfg), animate(sc, s, cfg)];
  }, [sc, tx, ty]);

  const fitView = useCallback((animated: boolean) => {
    const { w, h } = size.current;
    const i = insetRef.current ?? {};
    const vw = w - (i.right ?? 0), vh = h - (i.bottom ?? 0) - (i.top ?? 0);
    const s = Math.min(vw / (CORE.maxE - CORE.minE), vh / (CORE.maxN - CORE.minN)) * 0.94;
    const cx = (CORE.minE + CORE.maxE) / 2, cy = -(CORE.minN + CORE.maxN) / 2;
    const x = vw / 2 - cx * s, y = (i.top ?? 0) + vh / 2 - cy * s;
    if (animated) springTo(x, y, s, 0.8);
    else { tx.set(x); ty.set(y); sc.set(s); }
  }, [sc, springTo, tx, ty]);

  const zoomAt = useCallback((px: number, py: number, factor: number, animated = false) => {
    const s0 = sc.get();
    const s1 = Math.min(MAX_PX, Math.max(MIN_PX, s0 * factor));
    const k = s1 / s0;
    const x = px - (px - tx.get()) * k, y = py - (py - ty.get()) * k;
    if (animated) springTo(x, y, s1, 0.45);
    else { stopAnims(); sc.set(s1); tx.set(x); ty.set(y); }
  }, [sc, springTo, tx, ty]);

  useImperativeHandle(ref, () => ({
    focus(center, radius, inset = {}) {
      touched.current = true;
      const { w, h } = size.current;
      const vw = w - (inset.right ?? 0), vh = h - (inset.bottom ?? 0);
      const s = Math.min(MAX_PX * 0.8, Math.max(MIN_PX, Math.min(vw, vh) / (radius * 3.4)));
      springTo(vw / 2 - center[0] * s, vh / 2 - -center[1] * s, s, 0.75);
    },
    zoomBy(f) {
      touched.current = true;
      const { w, h } = size.current;
      zoomAt(w / 2, h / 2, f, true);
    },
    reset() { fitView(true); },
  }));

  // until the user moves the map, keep it fitted to whatever space the floating UI leaves free
  const insetKey = `${inset?.right ?? 0}/${inset?.bottom ?? 0}/${inset?.top ?? 0}`;
  useEffect(() => {
    if (!touched.current && size.current.w > 0) fitView(false);
  }, [insetKey, fitView]);

  // size + first fit
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => {
      const first = size.current.w === 0;
      size.current = { w: e.contentRect.width, h: e.contentRect.height };
      if (first && size.current.w > 0) { fitView(false); setReady(true); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  // wheel / trackpad pinch
  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016));
      zoomAt(e.clientX - r.left, e.clientY - r.top, f);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /* ── pointer gestures: 1 finger pans (1:1, rubber-banded at the edge, inertia on release); 2 fingers pinch ── */
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; moved: boolean; t0: number; target: string | null; hist: { t: number; x: number; y: number }[]; rawX: number; rawY: number; pinch?: { d: number; s: number } } | null>(null);

  const soft = (v: number, lo: number, hi: number, dim: number) => (v < lo ? lo + rubberband(v - lo, dim) : v > hi ? hi + rubberband(v - hi, dim) : v);

  const onDown = (e: React.PointerEvent) => {
    touched.current = true;
    stopAnims(); // grab a moving map and it stops under your finger
    const r = box.current!.getBoundingClientRect();
    ptrs.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    box.current!.setPointerCapture(e.pointerId);
    const hit = (e.target as Element).closest("[data-place]") as HTMLElement | null;
    if (ptrs.current.size === 1) {
      gesture.current = { startX: e.clientX, startY: e.clientY, moved: false, t0: performance.now(), target: hit?.dataset.place ?? null, hist: [], rawX: tx.get(), rawY: ty.get() };
    } else if (gesture.current) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: sc.get() };
      gesture.current.moved = true;
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const gs = gesture.current;
    const prev = ptrs.current.get(e.pointerId);
    if (!gs || !prev) return;
    const r = box.current!.getBoundingClientRect();
    const cur = { x: e.clientX - r.left, y: e.clientY - r.top };
    ptrs.current.set(e.pointerId, cur);
    if (ptrs.current.size >= 2 && gs.pinch) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const target = Math.min(MAX_PX, Math.max(MIN_PX, gs.pinch.s * (d / gs.pinch.d)));
      zoomAt(mid.x, mid.y, target / sc.get());
      return;
    }
    if (!gs.moved && Math.hypot(e.clientX - gs.startX, e.clientY - gs.startY) < 7) return; // hysteresis before committing to a drag
    gs.moved = true;
    gs.rawX += cur.x - prev.x;
    gs.rawY += cur.y - prev.y;
    const b = bounds(sc.get());
    const { w, h } = size.current;
    tx.set(soft(gs.rawX, b.xMin, b.xMax, w));
    ty.set(soft(gs.rawY, b.yMin, b.yMax, h));
    const now = performance.now();
    gs.hist.push({ t: now, x: cur.x, y: cur.y });
    while (gs.hist.length > 2 && now - gs.hist[0].t > 90) gs.hist.shift();
  };

  const onUp = (e: React.PointerEvent) => {
    const gs = gesture.current;
    ptrs.current.delete(e.pointerId);
    if (!gs) return;
    if (ptrs.current.size > 0) return;
    gesture.current = null;
    if (!gs.moved && performance.now() - gs.t0 < 500) { onSelect(gs.target); return; }
    // momentum: carry the finger's release velocity into the motion, clamped with an elastic edge
    const first = gs.hist[0], last = gs.hist[gs.hist.length - 1];
    const dt = first && last && last.t > first.t ? (last.t - first.t) / 1000 : 0;
    const vx = dt ? (last.x - first.x) / dt : 0, vy = dt ? (last.y - first.y) / dt : 0;
    const b = bounds(sc.get());
    const inert = (mv: typeof tx, v: number, min: number, max: number) =>
      animate(mv, mv.get(), { type: "inertia", velocity: v, power: 0.9, timeConstant: 260, min, max, bounceStiffness: 260, bounceDamping: 36 });
    // if released outside bounds, spring home from there; otherwise coast
    const outside = tx.get() < b.xMin || tx.get() > b.xMax || ty.get() < b.yMin || ty.get() > b.yMax;
    if (outside) {
      const cfg = { type: "spring", bounce: 0, duration: 0.45, velocity: 0 } as const;
      anims.current = [animate(tx, Math.min(b.xMax, Math.max(b.xMin, tx.get())), cfg), animate(ty, Math.min(b.yMax, Math.max(b.yMin, ty.get())), cfg)];
    } else if (Math.hypot(vx, vy) > 60) {
      anims.current = [inert(tx, vx, b.xMin, b.xMax), inert(ty, vy, b.yMin, b.yMax)];
    }
  };

  const onDouble = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, 2.2, true);
  };

  /* ── scene ── */
  const places = useMemo(() => PLACES.map((p) => ({ p, fp: footprintOf(p), c: placeCenter(p), r: placeRadius(p) })), []);
  const dim = (k: PlaceKind) => (kinds.has(k) ? 1 : 0.22);
  const showLabel = (p: Place) => (p.kind === "teaching" || p.id === "B1" ? true : bucket >= 1 && (p.kind !== "residence" || bucket >= 2));

  return (
    <div ref={box} className="absolute inset-0 touch-none select-none overflow-hidden" style={{ background: "var(--bg)", cursor: "grab", opacity: ready ? 1 : 0, transition: "opacity .4s" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={onDouble} role="application" aria-label="Interactive campus map. Use the list beside the map to browse places with a keyboard.">
      <svg ref={svg} width="100%" height="100%" className="block" aria-hidden>
        <g ref={g}>
          <Static />
          {/* building shadows give a little depth without a 3D engine */}
          {places.filter((x) => x.fp).map(({ p, fp }) => <polygon key={"s" + p.id} points={P(fp!.map((q) => [q[0] + 1.6, q[1] - 1.6] as EN))} fill="#000" opacity={0.16 * dim(p.kind)} />)}
          {GEO.buildings.filter((b) => !b.name || !PLACES.some((p) => p.osm === b.name)).map((b, i) => <polygon key={"u" + i} points={P(b.ring)} fill="var(--map-bldg)" stroke="var(--map-bldg-stroke)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" opacity={0.7} />)}
          {places.filter((x) => x.fp).map(({ p, fp }) => {
            const sel = selected === p.id;
            return (
              <polygon key={p.id} data-place={p.id} points={P(fp!)} fill={fillFor(p.kind)} stroke={sel ? "var(--accent)" : "var(--map-bldg-stroke)"} strokeWidth={sel ? 3 : 1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity={dim(p.kind)} style={{ cursor: "pointer", transition: "opacity .25s, stroke .15s" }} />
            );
          })}
          {places.filter((x) => !x.fp).map(({ p, c }) => (
            <circle key={p.id} data-place={p.id} cx={c[0]} cy={-c[1]} r={selected === p.id ? 14 : 10} fill={fillFor(p.kind)} stroke={selected === p.id ? "var(--accent)" : KIND_COLOR[p.kind]} strokeWidth={selected === p.id ? 3 : 1.5} vectorEffect="non-scaling-stroke" opacity={dim(p.kind)} style={{ cursor: "pointer", transition: "r .2s, opacity .25s" }} />
          ))}
        </g>

        {/* labels: constant on-screen size, positioned in world space */}
        <g aria-hidden>
          {places.filter((x) => showLabel(x.p) && kinds.has(x.p.kind) && !pins.some((q) => q.place === x.p.id)).map(({ p, c }) => (
            <g key={"l" + p.id} data-world={`${c[0]},${-c[1]}`} style={{ pointerEvents: "none" }}>
              <text textAnchor="middle" dy="0.35em" fontSize={p.kind === "teaching" ? 13 : 11} fontWeight={700} fill="var(--label)" stroke="var(--map-ground)" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.01em" }}>
                {p.id === "CANTEEN" ? "Canteen" : p.id === "CAFE" ? "Café" : p.id === "TRACK" ? "Track & Field" : p.id === "COURTS" ? "Courts" : p.id === "STATUE" ? "Statue" : p.id === "GATE" ? "East Gate" : p.id}
              </text>
            </g>
          ))}
          {pins.map((pin, i) => (
            <g key={pin.id} data-world={`${pin.at[0]},${-pin.at[1]}`} style={{ pointerEvents: "none" }}>
              <Marker label={pin.label} tone={pin.tone ?? "accent"} delay={i * 0.06} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});

function Marker({ label, tone, delay }: { label: string; tone: "accent" | "green" | "orange"; delay: number }) {
  const color = tone === "accent" ? "var(--accent)" : tone === "green" ? "var(--green)" : "var(--orange)";
  const isNum = /^\d+$/.test(label);
  return (
    <g style={{ animation: `pin-drop .5s cubic-bezier(.2,1.2,.4,1) ${delay}s both` }}>
      <circle r={20} cy={-26} fill={color} opacity={0.35} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "pulse-ring 1.8s ease-out infinite" }} />
      <path d="M-7 -14 L0 0 L7 -14 Z" fill={color} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      <circle r={14} cy={-26} fill={color} stroke="#fff" strokeWidth={2.5} />
      <text y={-26} dy="0.36em" textAnchor="middle" fontSize={isNum ? 14 : 11} fontWeight={800} fill="#fff" style={{ fontFamily: "var(--font-sans)" }}>{label}</text>
    </g>
  );
}
