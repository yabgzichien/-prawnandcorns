"use client";

import Link from "next/link";
import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import { FINANCE } from "@/lib/data/life";
import { dateShort, relative } from "@/lib/time";
import { useApp } from "@/lib/state";
import { Item, PageHeader, Pill, Ring, Stagger } from "@/components/ui/kit";

const money = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;

export function FinanceView() {
  const { openAgent } = useApp();
  const next = FINANCE.dues.find((d) => d.status === "upcoming")!;
  const outstanding = FINANCE.tuitionTotal - FINANCE.paid;
  return (
    <div>
      <PageHeader eyebrow="Semester 1" title="Finance" sub="What you owe, when, and what you've already paid. Figures here are invented for the demo." />
      <Stagger className="space-y-6">
        <Item>
          <section className="card grid min-w-0 grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <Ring value={FINANCE.paid / FINANCE.tuitionTotal} size={104} stroke={11} tone="var(--green)">
              <span className="text-center leading-tight"><span className="tnum block text-[1.4rem] font-bold tracking-[-0.03em]">{Math.round((FINANCE.paid / FINANCE.tuitionTotal) * 100)}%</span><span className="t-caption">paid</span></span>
            </Ring>
            <div className="min-w-0">
              <p className="t-eyebrow">Tuition outstanding</p>
              <p className="tnum t-display mt-1 break-words !text-[clamp(1.25rem,6vw,2.6rem)] sm:!text-[2.6rem]">{money(outstanding)}</p>
              <p className="t-sub mt-1">Next instalment due <strong className="text-label">{dateShort(new Date(next.due))}</strong>, {relative(new Date(next.due))}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/mail?dept=finance&need=my%20second%20tuition%20instalment" className="press btn btn-primary"><Mail size={17} /> Email Finance</Link>
              <button onClick={() => openAgent("How much do I owe?")} className="press btn btn-plain"><Sparkles size={16} /> Ask Compass</button>
            </div>
          </section>
        </Item>

        <Item>
          <h2 className="t-headline mb-3 px-1">Payment schedule</h2>
          <ol className="card divide-y divide-sep overflow-hidden">
            {FINANCE.dues.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: d.status === "paid" ? "var(--green-soft)" : d.status === "upcoming" ? "var(--orange-soft)" : "var(--surface-3)", color: d.status === "paid" ? "var(--green)" : d.status === "upcoming" ? "var(--orange)" : "var(--label-3)" }}>
                  {d.status === "paid" ? <Check size={18} strokeWidth={3} /> : <ArrowRight size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-[-0.01em]">{d.label}</p>
                  <p className="t-caption">{d.status === "paid" ? `Paid ${dateShort(new Date(d.paidOn!))}` : `Due ${dateShort(new Date(d.due))}, ${relative(new Date(d.due))}`}</p>
                </div>
                <p className="tnum text-[1.05rem] font-semibold">{money(d.amount)}</p>
                <Pill tone={d.status === "paid" ? "green" : d.status === "upcoming" ? "orange" : "purple"} className="hidden sm:inline-flex">{d.status === "paid" ? "Paid" : d.status === "upcoming" ? "Next" : "Later"}</Pill>
              </li>
            ))}
          </ol>
        </Item>

        <Item>
          <h2 className="t-headline mb-3 px-1">Payment history</h2>
          <ul className="card divide-y divide-sep overflow-hidden">
            {FINANCE.history.map((p) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1"><p className="font-semibold tracking-[-0.01em]">{p.label}</p><p className="t-caption">{p.date}, {p.method}</p></div>
                <p className="tnum font-semibold text-green">{money(p.amount)}</p>
              </li>
            ))}
          </ul>
          <p className="t-caption mt-3 px-1">Need an extension, receipt or refund? The Finance Office decides — Compass can draft the email, you send it.</p>
        </Item>
      </Stagger>
    </div>
  );
}
