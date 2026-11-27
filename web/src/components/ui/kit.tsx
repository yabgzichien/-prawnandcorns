"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { SPRING } from "@/lib/hooks";
import type { Tone } from "@/lib/data/academics";

export const toneClass: Record<Tone, { bg: string; fg: string; dot: string }> = {
  blue: { bg: "bg-accent-soft", fg: "text-accent", dot: "bg-accent" },
  orange: { bg: "bg-orange-soft", fg: "text-orange", dot: "bg-orange" },
  purple: { bg: "bg-purple-soft", fg: "text-purple", dot: "bg-purple" },
  green: { bg: "bg-green-soft", fg: "text-green", dot: "bg-green" },
  teal: { bg: "bg-teal-soft", fg: "text-teal", dot: "bg-teal" },
  red: { bg: "bg-red-soft", fg: "text-red", dot: "bg-red" },
};

export const featureTitleStyle: CSSProperties = {
  fontFamily: '"Abril Fatface", Georgia, serif',
  fontSize: "clamp(2.7rem, 5.2vw, 4rem)",
  fontWeight: 700,
  lineHeight: 1.12,
  letterSpacing: "0.005em",
  WebkitTextStroke: "0.35px currentColor",
};

export function PageHeader({ eyebrow, title, sub, action, titleStyle }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode; titleStyle?: CSSProperties }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-2">
      <div className="min-w-0">
        {eyebrow && <p className="t-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="t-title break-words" style={titleStyle}>{title}</h1>
        {sub && <p className="t-sub mt-2 max-w-xl text-pretty">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-orange-soft px-2.5 py-1 text-[0.72rem] font-semibold tracking-wide text-orange ${className}`} title="All student, course and finance information in this prototype is invented. No real records are used.">
      <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden /> Demo data
    </span>
  );
}

export function Pill({ tone = "blue", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = toneClass[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold leading-5 ${t.bg} ${t.fg} ${className}`}>{children}</span>;
}

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & HTMLMotionProps<"section">) {
  return (
    <motion.section {...rest} className={`card ${className}`}>
      {children}
    </motion.section>
  );
}

export function CardTitle({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <h2 className="t-headline flex min-w-0 items-center gap-2 break-words">{icon}<span className="card-title-text">{title}</span></h2>
      {action}
    </div>
  );
}

/** Staggered arrival for lists of blocks. Spring, no overshoot. */
export function Stagger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}>
      {children}
    </motion.div>
  );
}
export function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: SPRING } }}>
      {children}
    </motion.div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="press relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200" style={{ background: checked ? "var(--green)" : "var(--surface-3)" }}>
      <motion.span layout transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md" style={{ left: checked ? 22 : 2 }} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="relative inline-flex max-w-full flex-wrap rounded-full bg-surface-3 p-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className="press relative z-10 min-h-[34px] rounded-full px-2 text-[0.875rem] font-semibold sm:px-4" style={{ color: value === o.value ? "var(--label)" : "var(--label-2)" }}>
          {value === o.value && <motion.span layoutId={`seg-${label}`} transition={{ type: "spring", bounce: 0, duration: 0.35 }} className="absolute inset-0 -z-10 rounded-full bg-surface shadow-sm" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, tone = "var(--accent)", children }: { value: number; size?: number; stroke?: number; tone?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }} transition={{ type: "spring", bounce: 0, duration: 0.9 }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-sep px-6 py-10 text-center">
      <p className="t-headline">{title}</p>
      <p className="t-sub mt-1 max-w-sm">{body}</p>
    </div>
  );
}
