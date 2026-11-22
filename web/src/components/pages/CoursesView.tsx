"use client";

import { ExternalLink } from "lucide-react";
import { CORE_PLAN, COURSES, GE_GROUPS } from "@/lib/data/academics";
import { Item, PageHeader, Pill, Ring, Stagger, toneClass } from "@/components/ui/kit";
import { useApp } from "@/lib/state";

export function CoursesView() {
  const { openAgent } = useApp();
  const credits = COURSES.reduce((a, c) => a + c.credits, 0);
  return (
    <div>
      <PageHeader eyebrow="BSc Computer Science, Year 1" title="Courses" sub="What you&rsquo;re taking now, what&rsquo;s coming, and which General Education credits you still need."
        action={<a href="https://ac.xmu.edu.my/" target="_blank" rel="noreferrer" className="press btn btn-plain">Official handbook <ExternalLink size={15} /></a>} />

      <Stagger className="space-y-8">
        <Item>
          <div className="mb-3 flex items-end justify-between px-1">
            <h2 className="t-headline">This semester</h2>
            <p className="t-caption">{COURSES.length} courses, {credits} credits</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COURSES.map((c) => (
              <article key={c.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-2 text-[0.8rem] font-bold tracking-wide ${toneClass[c.tone].fg}`}><span className={`h-2 w-2 rounded-full ${toneClass[c.tone].dot}`} />{c.code}</span>
                  <Pill tone={c.kind === "Core" ? "blue" : "teal"}>{c.kind}, {c.credits} cr</Pill>
                </div>
                <h3 className="t-headline mt-3">{c.title}</h3>
                <p className="t-sub mt-1">{c.blurb}</p>
                <p className="t-caption mt-3 border-t border-sep pt-3">{c.lecturer}<br />{c.assessment}</p>
              </article>
            ))}
          </div>
        </Item>

        <Item>
          <h2 className="t-headline mb-3 px-1">Core outlook</h2>
          <ol className="card divide-y divide-sep">
            {CORE_PLAN.map((p) => (
              <li key={p.sem} className="flex flex-col gap-3 p-5 sm:flex-row sm:gap-8">
                <div className="w-40 shrink-0">
                  <p className="font-semibold tracking-[-0.01em]">{p.sem}</p>
                  <Pill tone={p.status === "current" ? "green" : p.status === "next" ? "blue" : "purple"} className="mt-1">{p.status === "current" ? "In progress" : p.status === "next" ? "Next" : "Later"}</Pill>
                </div>
                <ul className="grid flex-1 gap-x-6 gap-y-1.5 text-[0.93rem] sm:grid-cols-2">{p.items.map((i) => <li key={i} className="text-label-2">{i}</li>)}</ul>
              </li>
            ))}
          </ol>
          <p className="t-caption mt-2 px-1">Course lists are illustrative. Always confirm against the official programme handbook.</p>
        </Item>

        <Item>
          <div className="mb-3 flex items-end justify-between px-1">
            <h2 className="t-headline">General Education</h2>
            <button onClick={() => openAgent("Which GE courses should I take next semester?")} className="press text-[0.85rem] font-semibold text-accent">Ask Compass</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {GE_GROUPS.map((g) => (
              <article key={g.id} className="card flex gap-4 p-5">
                <Ring value={g.done / g.need} size={60} stroke={7} tone={g.done >= g.need ? "var(--green)" : "var(--accent)"}><span className="tnum text-[0.8rem] font-bold">{g.done}/{g.need}</span></Ring>
                <div className="min-w-0">
                  <h3 className="font-semibold tracking-[-0.01em]">{g.title}</h3>
                  <p className="t-caption">{g.need} credits needed{g.taking ? `, taking ${g.taking}` : ""}</p>
                  <p className="t-caption mt-2"><span className="font-semibold text-label">Options:</span> {g.options.join(", ")}</p>
                </div>
              </article>
            ))}
          </div>
        </Item>
      </Stagger>
    </div>
  );
}
