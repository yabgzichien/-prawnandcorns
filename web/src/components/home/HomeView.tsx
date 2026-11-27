"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion, Reorder, useDragControls } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, CalendarDays, GripVertical, RotateCcw, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useApp, WIDGET_META, DEFAULT_WIDGETS, type WidgetPref } from "@/lib/state";
import { STUDENT } from "@/lib/data/academics";
import { dayLong, dateShort, DEMO_NOW } from "@/lib/time";
import { SPRING, useMediaQuery } from "@/lib/hooks";
import { packWidgets, WIDGET_SIZES, type WidgetId, type WidgetSize } from "@/lib/widget-layout";
import { SUGGESTIONS } from "@/lib/agent";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/kit";
import { WIDGETS } from "./widgets";

const WIDGET_ART: Partial<Record<WidgetPref["id"], string>> = {
  alerts: "/brand/today-art/class-changes.png",
  fees: "/brand/today-art/fees.png",
  find: "/brand/today-art/find-a-room.png",
  clubs: "/brand/today-art/clubs-events.png",
  calendar: "/brand/today-art/today.png",
  attention: "/brand/today-art/due-soon.png",
  progress: "/brand/today-art/degree-progress.png",
  plans: "/brand/today-art/my-plans.png",
};

function WidgetArt({ id }: { id: WidgetId }) {
  const src = WIDGET_ART[id];
  return src ? <img className="home-widget-art" src={src} alt="" aria-hidden="true" /> : null;
}

export function HomeView() {
  const { widgets, openAgent, setWidgets, hydrated } = useApp();
  const [customise, setCustomise] = useState(false);
  const [ask, setAsk] = useState("");
  const [greeting, setGreeting] = useState("Good afternoon");
  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
    };
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const desktop = useMediaQuery("(min-width: 900px)");
  const visible = useMemo(() => widgets.filter((w) => !w.hidden), [widgets]);
  const calendar = visible.find((w) => w.id === "calendar");
  const cards = useMemo(() => visible.filter((w) => w.id !== "calendar"), [visible]);
  const resize = (id: WidgetId, size: WidgetSize) => setWidgets(widgets.map((w) => w.id === id ? { ...w, size } : w));

  return (
    <div className="home-view">
      <header className="home-header pb-6 pt-1">
        <div className="home-header-copy">
          <h1 className="t-display" style={{ letterSpacing: "0.005em" }}>{greeting}, {STUDENT.first}.</h1>
          <p className="home-date"><CalendarDays size={19} /> {dayLong(DEMO_NOW)} {dateShort(DEMO_NOW)} <span className="home-date-divider" /> {STUDENT.semester}</p>
        </div>
        <div className="home-campus-art" aria-hidden="true" />
        <div className="home-header-mascot" style={{ backgroundImage: 'url("/brand/corn-graduate.png")' }} aria-hidden="true" />
        <button onClick={() => setCustomise(true)} className="press btn btn-plain home-customise"><SlidersHorizontal size={17} /> Customise</button>
      </header>

      {/* The agent is the front door, not a side feature. */}
      <motion.form
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
        onSubmit={(e) => { e.preventDefault(); if (ask.trim()) { openAgent(ask.trim()); setAsk(""); } else openAgent(); }}
        className="home-search card mb-6 p-2 pl-5"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-3">
          <Search size={20} className="text-label-2" />
          <input value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Ask Compass" placeholder="Ask Compass…  e.g. “When is my next class?”, “Find a room in A3”" className="min-w-0 flex-1 bg-transparent py-3 text-[1.05rem] tracking-[-0.01em] outline-none placeholder:text-label-3" />
          <button className="press btn btn-primary home-ask-button"><Sparkles size={17} /> <span>Ask</span><ArrowUp size={16} className="sm:hidden" /></button>
        </div>
        <div className="rail -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} onClick={() => openAgent(s)} className="press shrink-0 rounded-full bg-surface-2 px-3.5 py-1.5 text-[0.82rem] font-medium text-label-2 ring-1 ring-sep">{s}</button>
          ))}
        </div>
      </motion.form>

      <div className="home-grid flex flex-col gap-4" style={{ opacity: hydrated ? 1 : 0.999 }}>
        {calendar && (
          <section aria-label={WIDGET_META.calendar.title} data-widget="calendar" className="home-widget card p-5">
            <WidgetArt id="calendar" />
            {WIDGETS.calendar("standard")}
          </section>
        )}
        <DashboardGrid cards={cards} desktop={desktop} editing={customise && desktop} resize={resize} />
      </div>

      {visible.length === 0 && (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="t-headline">Your dashboard is empty</p>
          <p className="t-sub mt-1">Switch cards on with Customise, or ask Compass to build it for you.</p>
        </div>
      )}

      <MotionConfig reducedMotion="user">
        <CustomiseSheet open={customise} onClose={() => setCustomise(false)} widgets={widgets} setWidgets={setWidgets} resize={desktop ? resize : undefined} onAsk={(p) => { setCustomise(false); openAgent(p); }} />
      </MotionConfig>
    </div>
  );
}

function DashboardGrid({ cards, desktop, editing, resize }: { cards: WidgetPref[]; desktop: boolean; editing: boolean; resize: (id: WidgetId, size: WidgetSize) => void }) {
  const grid = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [measurements, setMeasurements] = useState({ width: 0, gap: 16, heights: {} as Partial<Record<WidgetId, number>> });

  useLayoutEffect(() => {
    const root = grid.current;
    if (!root || !desktop) return;
    let previous = "";
    const measure = () => {
      const heights: Partial<Record<WidgetId, number>> = {};
      for (const element of root.querySelectorAll<HTMLElement>(":scope > [data-widget]")) {
        heights[element.dataset.widget as WidgetId] = Math.ceil(element.getBoundingClientRect().height);
      }
      const next = { width: root.clientWidth, gap: parseFloat(getComputedStyle(root).columnGap), heights };
      const signature = JSON.stringify([next.width, next.gap, Object.entries(heights).sort()]);
      if (signature === previous) return;
      previous = signature;
      const active = document.activeElement;
      if (active instanceof HTMLElement && root.contains(active)) focused.current = active;
      setMeasurements(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const card of root.children) observer.observe(card);
    return () => observer.disconnect();
  }, [cards, desktop]);

  useLayoutEffect(() => {
    if (document.activeElement === document.body && focused.current?.isConnected) {
      focused.current.focus({ preventScroll: true });
    }
    focused.current = null;
  });

  const packed = desktop && measurements.width >= 640 + measurements.gap;
  const positions = packed
    ? packWidgets(cards, measurements.heights, measurements.gap).map(({ card, column, span, top, height }) => ({
        card,
        style: { gridColumn: `${column + 1} / span ${span}`, gridRow: `${top + 1} / span ${height}` },
      }))
    : cards.map((card) => ({ card, style: undefined }));

  return (
    <LayoutGroup>
      <div ref={grid} className="home-card-grid grid items-start gap-4" data-packed={packed || undefined} hidden={cards.length === 0}>
        <AnimatePresence mode="popLayout" initial={false}>
          {positions.map(({ card, style }) => {
            const size = desktop ? card.size ?? "standard" : "standard";
            return (
              <motion.section
                key={card.id}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: 0 } : SPRING}
                aria-label={WIDGET_META[card.id].title}
                data-widget={card.id}
                data-size={size}
                className="home-widget card p-5"
                style={style}
              >
                <WidgetArt id={card.id} />
                {WIDGETS[card.id](size)}
                {editing && (
                  <div className="mt-3 flex">
                    <SizeSelect card={card} onResize={(id, value) => {
                      if (document.activeElement instanceof HTMLElement) focused.current = document.activeElement;
                      resize(id, value);
                    }} />
                  </div>
                )}
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

function SizeSelect({ card, onResize }: { card: WidgetPref; onResize: (id: WidgetId, size: WidgetSize) => void }) {
  return (
    <select className="home-card-size" aria-label={`Resize ${WIDGET_META[card.id].title}`} value={card.size ?? "standard"}
      onChange={(e) => onResize(card.id, e.currentTarget.value as WidgetSize)}>
      {WIDGET_SIZES.map((size) => <option key={size} value={size}>{size[0].toUpperCase() + size.slice(1)}</option>)}
    </select>
  );
}

function CustomiseSheet({ open, onClose, widgets, setWidgets, resize, onAsk }: { open: boolean; onClose: () => void; widgets: WidgetPref[]; setWidgets: (w: WidgetPref[]) => void; resize?: (id: WidgetId, size: WidgetSize) => void; onAsk: (p: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const done = useRef<HTMLButtonElement>(null);
  const desktop = !!resize;
  useEffect(() => {
    if (open && desktop) done.current?.focus({ preventScroll: true });
  }, [open, desktop]);
  return (
    <Sheet open={open} onClose={onClose} label="Customise dashboard">
      <div className="flex items-center justify-between px-5 pb-2 pt-3 lg:pt-5">
        <h2 className="t-headline">Customise Today</h2>
        <button ref={done} onClick={onClose} className="press btn btn-sm btn-primary">Done</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="t-sub mb-4">The calendar stays first. Drag cards to reorder or switch off what you don&rsquo;t need.{resize && " Choose a size for each visible card."} Or describe what you want.</p>

        <form onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) onAsk(prompt.trim()); }} className="mb-5 flex items-center gap-2 rounded-full bg-surface py-1 pl-4 pr-1 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
          <Sparkles size={17} className="text-accent" />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Describe your dashboard" placeholder="Show fees first, hide clubs" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-label-3" />
          <button className="press btn btn-sm btn-primary">Apply</button>
        </form>

        <Reorder.Group axis="y" values={widgets} onReorder={setWidgets} className="overflow-hidden rounded-2xl bg-surface" role="list">
          {widgets.map((w) => <Row key={w.id} w={w} resize={resize} onToggle={(hidden) => setWidgets(widgets.map((x) => (x.id === w.id ? { ...x, hidden } : x)))} />)}
        </Reorder.Group>

        <button onClick={() => setWidgets(DEFAULT_WIDGETS)} className="press btn btn-plain mt-4 w-full"><RotateCcw size={16} /> Reset to default</button>
      </div>
    </Sheet>
  );
}

function Row({ w, onToggle, resize }: { w: WidgetPref; onToggle: (hidden: boolean) => void; resize?: (id: WidgetId, size: WidgetSize) => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={w} drag={w.id !== "calendar"} dragListener={false} dragControls={controls} className="relative flex min-h-[56px] items-center gap-3 border-b border-sep bg-surface px-3 last:border-b-0" whileDrag={{ scale: 1.02, boxShadow: "var(--shadow-md)", zIndex: 5 }} transition={SPRING}>
      {w.id === "calendar" ? <CalendarDays size={18} className="mx-[7px] text-label-3" /> : <span onPointerDown={(e) => controls.start(e)} aria-label={`Reorder ${WIDGET_META[w.id].title}`} role="img" className="grid h-10 w-8 cursor-grab touch-none place-items-center text-label-3"><GripVertical size={18} /></span>}
      <span className="flex-1 text-[0.98rem] font-medium tracking-[-0.01em]" style={{ opacity: w.hidden ? 0.45 : 1 }}>{WIDGET_META[w.id].title}</span>
      {w.id !== "calendar" && !w.hidden && resize && <SizeSelect card={w} onResize={resize} />}
      <Switch checked={!w.hidden} onChange={(v) => onToggle(!v)} label={`Show ${WIDGET_META[w.id].title}`} />
    </Reorder.Item>
  );
}
