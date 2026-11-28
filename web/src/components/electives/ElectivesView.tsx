"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Check, Clock, Clock3, Copy, GraduationCap, Heart, Layers, Library, ListChecks, Lock, Minus, Plus, Search, SlidersHorizontal, Sparkles, UserRound, Users, Wand2, X, type LucideIcon } from "lucide-react";
import { CORE_CREDITS, CORE_SEM2, DEFAULT_TARGET, GE_BY_CODE, GE_CATALOGUE, SEMESTER_CREDIT_LIMIT, STUDENT_STREAM } from "@/lib/electives/catalogue";
import { meetingLabel } from "@/lib/electives/parse";
import { checkShortlist, clashText, courseStatus, electiveClashes, parsedOf, suggestSets, type CourseStatus, type SetSuggestion } from "@/lib/electives/plan";
import { ALLOWED_STREAMS, DEFAULT_PREFS, INTERESTS, PREF_LABEL, STREAMS, type GeCourse, type Interest, type Stream, type TimePrefs } from "@/lib/electives/types";
import type { Tone } from "@/lib/data/academics";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { Item, PageHeader, Pill, Ring, Segmented, Stagger } from "@/components/ui/kit";
import { CourseIcon, INTEREST_ICON, PREF_ICON } from "./icons";
import { WeekPreview } from "./WeekPreview";

export const STREAM_TONE: Record<Stream, Tone> = { Science: "teal", Business: "orange", Arts: "purple" };
const SPRING_FAST = { type: "spring", bounce: 0, duration: 0.3 } as const;

function initialInterests(raw: string | null): Interest[] {
  if (!raw) return [];
  const words = raw.toLowerCase().split(",").map((w) => w.trim());
  return INTERESTS.filter((i) => words.some((w) => w && i.toLowerCase().startsWith(w)));
}

/**
 * The general elective planner. The AC lists elective times as text; Compass reads them, checks them against the
 * Semester 2 core timetable and each other, applies the stream rule, and suggests sets that add up to the credits
 * the student needs. The student chooses, and saving a shortlist registers nothing.
 */
export function ElectivesView() {
  const params = useSearchParams();
  const { electives, saveElectives, clearElectives, showToast, hydrated } = useApp();
  const askedCredits = Number(params.get("credits"));
  const [target, setTarget] = useState(Number.isInteger(askedCredits) && askedCredits >= 1 && askedCredits <= 8 ? askedCredits : DEFAULT_TARGET);
  const [interests, setInterests] = useState<Interest[]>(() => initialInterests(params.get("likes")));
  const [prefs, setPrefs] = useState<TimePrefs>(DEFAULT_PREFS);
  const [stream, setStream] = useState<Stream>(STUDENT_STREAM);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<"can" | "all">("can");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const seeded = useRef(false);

  // once saved data has loaded, start from the saved shortlist
  useEffect(() => {
    if (!hydrated || seeded.current) return;
    seeded.current = true;
    if (electives) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from storage after hydration
      setSelected(electives.codes);
      if (!params.get("credits")) setTarget(electives.target);
    }
  }, [hydrated, electives, params]);

  const suggestions = useMemo(() => suggestSets({ stream, target, interests, prefs }), [stream, target, interests, prefs]);
  const check = useMemo(() => checkShortlist(selected, stream, target), [selected, stream, target]);
  const clashCount = useMemo(() => selected.reduce((n, c) => n + electiveClashes(c, selected).length, 0) / 2, [selected]);
  const ownStream = stream === STUDENT_STREAM;
  const savedSame = !!electives && electives.target === target && electives.codes.length === selected.length && electives.codes.every((c) => selected.includes(c));

  const toggle = (code: string) => { setError(""); setSelected((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code])); };
  const chooseSet = (s: SetSuggestion) => { setError(""); setSelected(s.codes); };

  const save = () => {
    const r = saveElectives(selected, target);
    setError(r.ok ? "" : r.error);
  };
  const copy = async () => {
    const text = selected.join(", ");
    try { await navigator.clipboard.writeText(text); showToast("Course codes copied. Paste them into the AC system when you register."); }
    catch { showToast(`Could not copy. Your codes are ${text}.`); }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GE_CATALOGUE
      .filter((c) => filter === "all" || ALLOWED_STREAMS[stream].includes(c.stream))
      .filter((c) => !q || `${c.code} ${c.title} ${c.stream} ${c.tags.join(" ")}`.toLowerCase().includes(q))
      .map((c) => ({ c, st: courseStatus(c, stream, selected) }))
      .sort((a, b) => rankStatus(a.st) - rankStatus(b.st) || a.c.code.localeCompare(b.c.code));
  }, [query, filter, stream, selected]);

  const totalCredits = CORE_CREDITS + check.credits;

  return (
    <div>
      <PageHeader eyebrow="Semester 2, from 1 March 2027 (demo dates)" title="General electives" sub="The AC lists elective times as text. Compass reads each one, checks it against your Semester 2 core classes and your other choices, and suggests sets that add up to the credits you need." />

      <Stagger className="space-y-6">
        {/* the summary stays in view while choosing */}
        <Item className="z-20 transition-[top] duration-300 sm:sticky sm:top-[calc(var(--banner-cover,0px)+var(--hub-nav-cover,0px)+0.75rem)]">
          <div className="glass-thick flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[24px] p-3 pl-4">
            <Ring value={target ? check.credits / target : 0} size={52} stroke={6} tone={check.credits === target ? "var(--green)" : check.credits > target ? "var(--orange)" : "var(--accent)"}>
              <span className="tnum text-[0.78rem] font-bold">{check.credits}/{target}</span>
            </Ring>
            <div className="min-w-0 flex-1 basis-[13rem]" aria-live="polite">
              <p className="font-semibold tracking-[-0.01em]">{selected.length === 0 ? "No electives chosen yet" : `${selected.length} elective${selected.length === 1 ? "" : "s"}, ${check.credits} of ${target} credits`}</p>
              <p className="t-caption">
                {clashCount > 0 ? <span className="font-semibold text-red">{clashCount} clash{clashCount === 1 ? "" : "es"} to fix. </span> : selected.length ? <span className="font-semibold text-green">No clashes. </span> : null}
                {CORE_CREDITS} core + {check.credits} GE = {totalCredits} of {SEMESTER_CREDIT_LIMIT} credits. {savedSame ? "Saved in this browser, not registered." : "Not saved."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {savedSame && <button onClick={copy} className="press btn btn-sm btn-plain"><Copy size={14} /> Copy codes</button>}
              <button onClick={save} disabled={!ownStream || !check.ok || savedSame} className="press btn btn-sm btn-primary disabled:opacity-45">{savedSame ? <><Check size={15} /> Saved</> : "Save shortlist"}</button>
            </div>
            {(error || (!ownStream && selected.length > 0) || (selected.length > 0 && !check.ok)) && (
              <p role="alert" className="basis-full text-[0.84rem] font-semibold text-red">
                {error || (!ownStream ? "Saving is off while you view another stream." : check.problems[0])}
              </p>
            )}
          </div>
        </Item>

        <Item>
          <section className="card p-4 sm:p-5" aria-labelledby="ge-needs">
            <h2 id="ge-needs" className="t-headline mb-4 flex items-center gap-2"><SlidersHorizontal size={18} className="text-accent" /> What you need</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <Label icon={GraduationCap}>GE credits this semester</Label>
                <div className="flex items-center gap-3">
                  <button aria-label="One credit fewer" disabled={target <= 1} onClick={() => setTarget((t) => Math.max(1, t - 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-surface-3 disabled:opacity-40"><Minus size={17} /></button>
                  <motion.span key={target} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_FAST} className="tnum w-10 text-center text-[1.9rem] font-bold tracking-[-0.03em]" aria-live="polite" aria-label={`${target} credits`}>{target}</motion.span>
                  <button aria-label="One credit more" disabled={target >= SEMESTER_CREDIT_LIMIT - CORE_CREDITS} onClick={() => setTarget((t) => Math.min(SEMESTER_CREDIT_LIMIT - CORE_CREDITS, t + 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-surface-3 disabled:opacity-40"><Plus size={17} /></button>
                </div>
                <p className="t-caption mt-2">Your programme plan says {DEFAULT_TARGET} this semester (demo). Change it if the AC told you a different number.</p>
              </div>
              <div>
                <Label icon={Layers}>Your stream</Label>
                <p className="font-semibold">{stream}{ownStream ? " (BSc Computer Science)" : " (demo view)"}</p>
                <p className="t-caption mt-1">You may take <strong className="text-label">{ALLOWED_STREAMS[stream].join(" and ")}</strong> electives, not {stream} ones.</p>
                <div className="mt-3">
                  <p className="t-caption mb-1.5">Demo: see the rule for another stream</p>
                  <Segmented label="Stream" value={stream} onChange={(v) => { setStream(v); setError(""); }} options={STREAMS.map((s) => ({ value: s, label: s }))} />
                </div>
              </div>
              <div>
                <Label icon={Clock3}>Time preferences</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PREF_LABEL) as (keyof TimePrefs)[]).map((k) => <Chip key={k} icon={PREF_ICON[k]} on={prefs[k]} onClick={() => setPrefs((p) => ({ ...p, [k]: !p[k] }))}>{PREF_LABEL[k]}</Chip>)}
                </div>
                <p className="t-caption mt-2">Suggestions avoid these when they can. They never hide a course.</p>
              </div>
            </div>
            <div className="mt-5 border-t border-sep pt-4">
              <Label icon={Heart}>What do you enjoy? Suggestions lean towards these.</Label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map((i) => <Chip key={i} icon={INTEREST_ICON[i]} on={interests.includes(i)} onClick={() => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}>{i}</Chip>)}
              </div>
            </div>
          </section>
        </Item>

        <Item>
          <section aria-labelledby="ge-suggest">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
              <h2 id="ge-suggest" className="t-headline flex items-center gap-2"><Sparkles size={18} className="text-accent" /> Suggested sets</h2>
              <p className="t-caption">Worked out by Compass from the rules above. Nothing is chosen until you pick.</p>
            </div>
            {suggestions.length === 0 ? (
              <div className="card p-5 text-center"><p className="t-sub">No set of electives fits your timetable for {target} credits. Try fewer credits.</p></div>
            ) : (
              <LayoutGroup>
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
                  {suggestions.map((s, i) => <SuggestionCard key={s.codes.join("+")} s={s} best={i === 0} active={s.codes.length === selected.length && s.codes.every((c) => selected.includes(c))} onUse={() => chooseSet(s)} />)}
                </div>
              </LayoutGroup>
            )}
          </section>
        </Item>

        <Item>
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="card min-w-0 p-4 sm:p-5" aria-labelledby="ge-week">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 id="ge-week" className="t-headline flex items-center gap-2"><CalendarDays size={18} className="text-accent" /> Your Semester 2 week</h2>
                <p className="t-caption">Core classes as the AC published them (demo), with your electives on top.</p>
              </div>
              <WeekPreview core={CORE_SEM2} selected={selected} />
            </section>
            <section className="card p-4 sm:p-5" aria-labelledby="ge-picked">
              <h2 id="ge-picked" className="t-headline mb-3 flex items-center gap-2"><ListChecks size={18} className="text-accent" /> Your choices</h2>
              {selected.length === 0 ? (
                <p className="t-sub">Pick a suggested set or add electives from the list below.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2">
                  <AnimatePresence initial={false}>
                    {selected.map((code) => {
                      const c = GE_BY_CODE[code];
                      if (!c) return null;
                      const st = courseStatus(c, stream, selected);
                      return (
                        <motion.li key={code} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={SPRING_FAST} className="min-w-0 rounded-2xl bg-surface-3 p-3">
                          <div className="flex items-start gap-2.5">
                            <CourseIcon tag={c.tags[0]} stream={c.stream} size={34} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.92rem] [overflow-wrap:anywhere] font-semibold leading-snug hyphens-auto">{c.code} {c.title}</p>
                              <p className="t-caption">{c.credits} credit{c.credits === 1 ? "" : "s"}, {c.stream}</p>
                            </div>
                            <button onClick={() => toggle(code)} aria-label={`Remove ${c.code}`} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-label-2"><X size={14} /></button>
                          </div>
                          {st.kind !== "fits" && <p className="mt-1.5 flex items-start gap-1.5 text-[0.8rem] font-semibold text-red"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{st.message}</p>}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
              {check.warnings.length > 0 && selected.length > 0 && <p className="t-caption mt-3">{check.warnings.join(" ")}</p>}
              {electives && (
                <div className="mt-4 border-t border-sep pt-3">
                  <p className="t-caption">Saved shortlist: <span className="font-semibold text-label">{electives.codes.join(", ")}</span></p>
                  <button onClick={() => { clearElectives(); showToast("Saved shortlist removed from this browser."); }} className="press mt-1 text-[0.82rem] font-semibold text-red">Remove saved shortlist</button>
                </div>
              )}
              <p className="t-caption mt-4">Compass cannot register you. When you are happy, register these in the AC system yourself.</p>
            </section>
          </div>
        </Item>

        <Item>
          <section aria-labelledby="ge-all">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
              <h2 id="ge-all" className="t-headline flex items-center gap-2"><Library size={18} className="text-accent" /> All electives</h2>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="relative block min-w-0">
                  <span className="sr-only">Search electives</span>
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label-3" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="min-h-[38px] w-[170px] max-w-full rounded-full bg-surface-3 pl-9 pr-3 text-[0.9rem] outline-none focus-visible:ring-2 focus-visible:ring-accent" />
                </label>
                <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: "can", label: "You can take" }, { value: "all", label: "All streams" }]} />
              </div>
            </div>
            {list.length === 0 && <p className="t-sub px-1">No electives match.</p>}
            <ul className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              {list.map(({ c, st }) => <CourseRow key={c.code} c={c} st={st} on={selected.includes(c.code)} onToggle={() => toggle(c.code)} />)}
            </ul>
            <p className="t-caption mt-3 px-1">Every course, time and seat count here is invented for the demo. Check the real list on the AC before you register.</p>
          </section>
        </Item>
      </Stagger>
    </div>
  );
}

const rankStatus = (s: CourseStatus) => ({ fits: 0, "ge-clash": 1, "core-clash": 2, full: 3, unreadable: 4, stream: 5 })[s.kind];

function Label({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <p className="t-caption mb-2 flex items-center gap-1.5 font-semibold"><Icon size={14} className="shrink-0" />{children}</p>;
}

function Chip({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: LucideIcon; children: ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick} className="press inline-flex min-h-[36px] max-w-full items-center gap-1.5 break-words rounded-full px-3.5 text-left text-[0.85rem] font-semibold transition-colors duration-150" style={{ background: on ? "var(--accent)" : "var(--surface-3)", color: on ? "var(--accent-fg)" : "var(--label)" }}>
      {on ? <Check size={14} strokeWidth={2.6} className="shrink-0" /> : <Icon size={14} className="shrink-0 opacity-70" />}<span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </button>
  );
}

function SuggestionCard({ s, best, active, onUse }: { s: SetSuggestion; best: boolean; active: boolean; onUse: () => void }) {
  return (
    <motion.article layout transition={SPRING} className="card flex min-w-0 flex-col p-4" style={{ outline: active ? "2px solid var(--accent)" : undefined, outlineOffset: active ? 2 : undefined }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {best ? <Pill tone="green">Best match</Pill> : <span className="t-caption font-semibold">Option</span>}
        <span className="tnum t-caption font-semibold">{s.credits} credits</span>
      </div>
      <ul className="grid gap-2">
        {s.codes.map((code) => {
          const c = GE_BY_CODE[code];
          return (
            <li key={code} className="flex min-w-0 items-start gap-2.5">
              <CourseIcon tag={c.tags[0]} stream={c.stream} size={32} />
              <div className="min-w-0">
              <p className="text-[0.95rem] [overflow-wrap:anywhere] font-semibold leading-snug tracking-[-0.01em] hyphens-auto">{c.title}</p>
              <p className="t-caption">{c.code}, {c.credits} cr, {parsedOf(code).meetings.map((m) => meetingLabel(m)).join("; ")}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <ul className="mt-3 grid gap-1 border-t border-sep pt-3">
        {s.reasons.map((r) => <li key={r} className="flex items-start gap-1.5 text-[0.82rem] text-label-2"><Check size={13} className="mt-0.5 shrink-0 text-green" />{r}</li>)}
        {s.warnings.map((w) => <li key={w} className="flex items-start gap-1.5 text-[0.82rem] text-orange"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{w}</li>)}
      </ul>
      <button onClick={onUse} disabled={active} className={`press btn btn-sm mt-auto w-full translate-y-0 ${active ? "btn-tint" : "btn-primary"}`} style={{ marginTop: 14 }}>
        {active ? <><Check size={14} /> In your choices</> : <><Wand2 size={14} /> Use this set</>}
      </button>
    </motion.article>
  );
}

function StatusLine({ st }: { st: CourseStatus }) {
  const look = {
    fits: { cls: "text-green", icon: <Check size={14} /> },
    "ge-clash": { cls: "text-red", icon: <AlertTriangle size={14} /> },
    "core-clash": { cls: "text-red", icon: <AlertTriangle size={14} /> },
    full: { cls: "text-label-2", icon: <Lock size={14} /> },
    stream: { cls: "text-label-2", icon: <Lock size={14} /> },
    unreadable: { cls: "text-orange", icon: <AlertTriangle size={14} /> },
  }[st.kind];
  return <p className={`mt-2 flex items-start gap-1.5 text-[0.84rem] font-semibold ${look.cls}`}><span className="mt-0.5 shrink-0">{look.icon}</span><span className="min-w-0 break-words">{st.message}</span></p>;
}

function CourseRow({ c, st, on, onToggle }: { c: GeCourse; st: CourseStatus; on: boolean; onToggle: () => void }) {
  const parsed = parsedOf(c.code);
  const blocked = st.kind === "stream" || st.kind === "full" || st.kind === "unreadable" || st.kind === "core-clash";
  const dim = st.kind === "stream" || st.kind === "full";
  return (
    <li className={`card flex min-w-0 flex-col p-4 transition-opacity ${dim ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <CourseIcon tag={c.tags[0]} stream={c.stream} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.78rem] font-bold tracking-wide text-label-2">{c.code}</span>
            <Pill tone={STREAM_TONE[c.stream]}>{c.stream}</Pill>
            <span className="t-caption font-semibold">{c.credits} credit{c.credits === 1 ? "" : "s"}</span>
          </div>
          <h3 className="mt-1 text-[1.02rem] [overflow-wrap:anywhere] font-semibold leading-snug tracking-[-0.012em] hyphens-auto">{c.title}</h3>
          <p className="t-caption mt-0.5">{c.blurb}</p>
        </div>
        <button onClick={onToggle} disabled={blocked && !on} aria-pressed={on} aria-label={on ? `Remove ${c.code} from your choices` : `Add ${c.code} to your choices`} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-35" style={{ background: on ? "var(--accent)" : "var(--surface-3)", color: on ? "var(--accent-fg)" : "var(--label)" }}>
          {on ? <Check size={18} strokeWidth={2.6} /> : <Plus size={18} />}
        </button>
      </div>
      <div className="mt-3 rounded-xl bg-surface-3 px-3 py-2">
        {parsed.meetings.length > 0 ? (
          <ul className="grid gap-0.5">{parsed.meetings.map((m, i) => <li key={i} className="flex items-start gap-1.5 text-[0.85rem] font-medium"><Clock size={13} className="mt-[3px] shrink-0 text-label-2" /><span className="min-w-0">{meetingLabel(m)}{m.room ? `, ${m.room}` : ""}</span></li>)}</ul>
        ) : (
          <p className="text-[0.85rem] font-medium text-orange">Time not readable</p>
        )}
        <p className="mt-1 break-words text-[0.75rem] text-label-3">AC text: &ldquo;{c.schedule}&rdquo;</p>
      </div>
      <StatusLine st={st} />
      {st.kind === "ge-clash" && st.clashes && st.clashes.length > 1 && <p className="t-caption mt-0.5">{st.clashes.slice(1).map(clashText).join(". ")}</p>}
      <p className="t-caption mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5"><span className="inline-flex items-center gap-1"><Users size={13} className="shrink-0" />{c.seats > 0 ? `${c.seats} of ${c.capacity} seats left` : `All ${c.capacity} seats taken`}</span><span className="inline-flex items-center gap-1"><UserRound size={13} className="shrink-0" />{c.lecturer}</span></p>
    </li>
  );
}
