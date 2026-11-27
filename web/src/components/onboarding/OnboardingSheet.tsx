"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Lock, RefreshCw, Sparkles } from "lucide-react";
import { SYSTEM_ICON } from "@/components/connections/ConnectionsView";
import { Sheet } from "@/components/ui/Sheet";
import { Pill } from "@/components/ui/kit";
import { STUDENT } from "@/lib/data/academics";
import { readOnboarding, subscribeOnboarding, writeOnboarding, type OnboardingState } from "@/lib/onboarding";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { SYSTEM_IDS, SYSTEM_LABEL, type SystemId } from "@/lib/world/types";

const SUMMARY: Record<SystemId, string> = {
  moodle: "Courses, assignments and announcements",
  ac: "Timetable and official notices",
  finance: "Fee balance and instalment dates",
  mail: "Subject, sender and text of inbox messages",
};

const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
const buttonLabel = (n: number) => (n === SYSTEM_IDS.length ? "Allow and connect all four" : n === 1 ? "Allow and connect 1 system" : `Allow and connect ${n} systems`);

/**
 * First-run step on Today. It connects the four invented systems in one tap so Compass has something to notice.
 * It never asks for a student ID, password or course: the invented connectors supply them (UX-ADR-008).
 */
export function OnboardingSheet({ enabled }: { enabled: boolean }) {
  const { hydrated, connected } = useCampus();
  // The server and the first client render say "done", so the sheet never flashes before storage is read.
  const saved = useSyncExternalStore(subscribeOnboarding, readOnboarding, (): OnboardingState => "done");
  // Stays true once the student pressed Allow, so the sheet can show the result after systems become connected.
  const [engaged, setEngaged] = useState(false);

  const open = enabled && hydrated && saved === "none" && (engaged || connected.length === 0);
  const finish = (kind: "done" | "skipped") => { writeOnboarding(kind); setEngaged(false); };

  return (
    <Sheet open={open} onClose={() => finish(engaged ? "done" : "skipped")} label="Connect your campus systems" modalOnDesktop>
      <Content onEngage={() => setEngaged(true)} onFinish={finish} />
    </Sheet>
  );
}

function Content({ onEngage, onFinish }: { onEngage: () => void; onFinish: (kind: "done" | "skipped") => void }) {
  const { connections, syncing, failed, snapshot, connectMany, syncNow } = useCampus();
  const { openAgent } = useApp();
  const [picked, setPicked] = useState<SystemId[]>(() => [...SYSTEM_IDS]);
  const [result, setResult] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The button that was pressed disappears, so move focus to the new heading instead of losing it.
  useEffect(() => { if (result) headingRef.current?.focus({ preventScroll: true }); }, [result]);

  const toggle = (system: SystemId) => setPicked((now) => SYSTEM_IDS.filter((id) => (id === system ? !now.includes(id) : now.includes(id))));
  const allow = () => {
    if (picked.length === 0) return;
    if (!connectMany(picked)) { setError("Could not save the connections. Check that site storage is enabled, then try again."); return; }
    setError("");
    setResult(true);
    onEngage();
  };

  const connectedNow = SYSTEM_IDS.filter((s) => connections[s]);
  const problems = failed.filter((f) => connections[f.system]);
  const allRead = connectedNow.length > 0 && connectedNow.every((s) => snapshot?.fetchedAt[s]);

  return (
    <motion.div key={result ? "result" : "ask"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-3 lg:pt-7">
        <div className="flex items-center gap-3">
          <Image src="/brand/corn-prawn-logo.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
          <p className="t-eyebrow">Welcome to XMUM Compass</p>
        </div>

        {!result ? (
          <>
            <h2 ref={headingRef} tabIndex={-1} className="t-title mt-5 !text-[1.6rem] outline-none">Connect your campus systems</h2>
            <p className="t-sub mt-2">Signed in as {STUDENT.name} (demo student). These four systems are invented, so there is no password to enter.</p>

            <h3 className="t-eyebrow mt-7">Compass would like to read</h3>
            <ul className="mt-3 space-y-2">
              {SYSTEM_IDS.map((system) => {
                const Icon = SYSTEM_ICON[system];
                return (
                  <li key={system}>
                    <label className="press flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-sep has-[:checked]:ring-accent/45has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden><Icon size={20} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold tracking-[-0.01em]">{SYSTEM_LABEL[system]}</span>
                        <span className="t-caption block">{SUMMARY[system]}</span>
                      </span>
                      <input type="checkbox" checked={picked.includes(system)} onChange={() => toggle(system)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 flex gap-3 rounded-2xl bg-surface-3 p-3.5 text-[0.85rem] leading-snug text-label-2">
              <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>Read only. Compass cannot change anything in these systems, and no real XMUM system is contacted. What it reads stays in this browser, and you can disconnect at any time.</span>
            </p>
            {error && <p role="alert" className="mt-3 text-[0.85rem] font-semibold text-red">{error}</p>}
          </>
        ) : (
          <div role="status" aria-live="polite">
            <h2 ref={headingRef} tabIndex={-1} className="t-title mt-5 !text-[1.6rem] outline-none">
              {problems.length ? "Connected, with a problem" : allRead ? "You are connected" : "Reading your systems"}
            </h2>
            <p className="t-sub mt-2">
              {problems.length ? "Compass could not read every system. You can try again or carry on."
                : allRead ? `Compass read invented data from ${connectedNow.length === 1 ? "1 system" : `${connectedNow.length} systems`}. Nothing in them was changed.`
                  : "This takes about a second."}
            </p>
            <ul className="mt-6 space-y-2">
              {SYSTEM_IDS.map((system) => {
                const Icon = SYSTEM_ICON[system];
                const on = Boolean(connections[system]);
                const problem = problems.find((f) => f.system === system);
                const last = snapshot?.fetchedAt[system];
                return (
                  <li key={system} className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-sep">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent" aria-hidden><Icon size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold tracking-[-0.01em]">
                        {SYSTEM_LABEL[system]}
                        {on ? (problem ? <Pill tone="orange">Unavailable</Pill> : last ? <Pill tone="green">Connected</Pill> : <Pill tone="blue">Reading</Pill>) : <Pill tone="blue">Not connected</Pill>}
                      </span>
                      <span className="t-caption block">
                        {!on ? "You can connect it later in Connections."
                          : problem ? problem.error.message
                            : last ? `Read at ${timeOf(last)}.` : syncing ? "Reading now." : "Connected. Not read yet."}
                      </span>
                    </span>
                    {problem && <button onClick={() => void syncNow()} disabled={syncing} className="press btn btn-sm btn-tint shrink-0"><RefreshCw size={14} /> Try again</button>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-sep px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {!result ? (
          <>
            <button onClick={allow} disabled={picked.length === 0} className="press btn btn-primary w-full disabled:opacity-40">{picked.length === 0 ? "Choose a system to connect" : buttonLabel(picked.length)}</button>
            <button onClick={() => onFinish("skipped")} className="press btn btn-plain mt-2 w-full">Skip for now</button>
          </>
        ) : (
          <>
            <button onClick={() => { onFinish("done"); openAgent("Plan my week"); }} className="press btn btn-primary w-full"><Sparkles size={17} /> Plan my week with Compass</button>
            <button onClick={() => onFinish("done")} className="press btn btn-plain mt-2 w-full">Done</button>
          </>
        )}
      </div>
    </motion.div>
  );
}
