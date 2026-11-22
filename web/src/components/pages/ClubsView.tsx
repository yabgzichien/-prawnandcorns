"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Check, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { CLUBS, EVENTS } from "@/lib/data/life";
import { useApp } from "@/lib/state";
import { SPRING } from "@/lib/hooks";
import { Item, PageHeader, Pill, Stagger } from "@/components/ui/kit";

const CATS = ["All", "Tech", "Sports", "Arts", "Culture", "Service"] as const;

export function ClubsView() {
  const { joined, toggleClub, openAgent, showToast } = useApp();
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [q, setQ] = useState("");
  const list = CLUBS.filter((c) => (cat === "All" || c.category === cat) && (c.name + c.blurb + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="ECA" title="Clubs & events" sub="Find your people. Meeting times are checked against your timetable."
        action={<button onClick={() => openAgent("I like robotics and photography — which clubs fit?")} className="press btn btn-primary"><Sparkles size={17} /> Match me</button>} />

      <Stagger className="space-y-8">
        <Item>
          <h2 className="t-headline mb-3 px-1">Coming up</h2>
          <div className="rail -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {EVENTS.map((e) => (
              <article key={e.id} className="card w-[260px] shrink-0 p-4">
                <p className="t-eyebrow text-accent">{e.when}</p>
                <h3 className="t-headline mt-1.5">{e.title}</h3>
                <p className="t-caption mt-1">{e.where}</p>
                {e.room && <Link href={`/map?q=${encodeURIComponent(e.room)}`} className="press mt-3 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-accent"><MapPin size={14} /> Where is it?</Link>}
              </article>
            ))}
          </div>
        </Item>

        <Item>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="rail flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Category">
              {CATS.map((c) => (
                <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className="press min-h-[38px] shrink-0 rounded-full px-4 text-[0.88rem] font-semibold" style={{ background: cat === c ? "var(--label)" : "var(--surface)", color: cat === c ? "var(--bg)" : "var(--label)", boxShadow: "var(--shadow-sm)" }}>{c}</button>
              ))}
            </div>
            <label className="ml-auto flex min-w-[200px] items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
              <Search size={16} className="text-label-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs" aria-label="Search clubs" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-label-3" />
            </label>
          </div>
          <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((c) => {
                const on = joined.includes(c.id);
                return (
                  <motion.article key={c.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING} className="card flex flex-col p-5">
                    <div className="flex items-center justify-between gap-2"><Pill tone={c.category === "Tech" ? "blue" : c.category === "Sports" ? "green" : c.category === "Arts" ? "purple" : c.category === "Culture" ? "orange" : "teal"}>{c.category}</Pill><span className="t-caption tnum">{c.members} members</span></div>
                    <h3 className="t-headline mt-3">{c.name}</h3>
                    <p className="t-sub mt-1 flex-1">{c.blurb}</p>
                    <p className="t-caption mt-3">{c.meets}{c.room ? <>, <Link href={`/map?q=${encodeURIComponent(c.room)}`} className="font-semibold text-accent">{c.room}</Link></> : ""}</p>
                    <button
                      onClick={() => { toggleClub(c.id); showToast(on ? `Left ${c.name}` : c.recruiting ? `Interest sent to ${c.name}` : `Added to ${c.name} waitlist`); }}
                      aria-pressed={on}
                      className={`press btn btn-sm mt-4 ${on ? "btn-plain" : c.recruiting ? "btn-primary" : "btn-tint"}`}
                    >
                      {on ? <><Check size={15} strokeWidth={3} /> Joined</> : <><Plus size={15} strokeWidth={3} /> {c.recruiting ? "Join" : "Join waitlist"}</>}
                    </button>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
          {list.length === 0 && <p className="t-sub mt-4 px-1">No clubs match. Try “Match me” and describe what you enjoy.</p>}
        </Item>
      </Stagger>
    </div>
  );
}
