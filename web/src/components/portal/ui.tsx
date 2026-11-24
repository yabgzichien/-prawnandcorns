"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A small kit for the presenter portal. It borrows the layout and structure of a university e-services site
 * (dark sidebar, light page, white cards, blue primary) without any real logo, crest, name or link.
 * The portal is always light, whatever the student app's theme is.
 */
export const PORTAL_VARS: CSSProperties = {
  ["--p-bg" as string]: "#f5f8fa",
  ["--p-surface" as string]: "#ffffff",
  ["--p-ink" as string]: "#181c32",
  ["--p-muted" as string]: "#6b7186",
  ["--p-line" as string]: "#e6ebf0",
  ["--p-primary" as string]: "#1b6ef3",
  ["--p-primary-soft" as string]: "#e8f1ff",
  ["--p-sidebar" as string]: "#1e1e2d",
  ["--p-sidebar-ink" as string]: "#a3a6bd",
  ["--p-success" as string]: "#13a54b",
  ["--p-success-soft" as string]: "#e5f7ec",
  ["--p-danger" as string]: "#d6194f",
  ["--p-danger-soft" as string]: "#fde8ee",
  ["--p-warn" as string]: "#9a6700",
  ["--p-warn-soft" as string]: "#fff4d6",
  colorScheme: "light",
};

export type PTone = "blue" | "purple" | "green" | "orange" | "teal" | "gray" | "red";
const TONE: Record<PTone, string> = {
  blue: "bg-[#e8f1ff] text-[#1556c0]",
  purple: "bg-[#f1e9ff] text-[#6a35c9]",
  green: "bg-[#e5f7ec] text-[#0f7a37]",
  orange: "bg-[#fff0dc] text-[#a35200]",
  teal: "bg-[#dff6f5] text-[#0b6f6c]",
  gray: "bg-[#eef1f5] text-[#4b5266]",
  red: "bg-[#fde8ee] text-[#b3113f]",
};

export function Badge({ tone = "gray", children, className = "" }: { tone?: PTone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.72rem] font-semibold leading-5 ${TONE[tone]} ${className}`}>{children}</span>;
}

export function PCard({ title, subtitle, action, children, className = "", bodyClass = "p-5" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--p-line)] bg-[var(--p-surface)] shadow-[0_1px_3px_rgba(24,28,50,0.04)] ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--p-line)] px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[1rem] font-semibold tracking-[-0.01em] text-[var(--p-ink)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[0.82rem] text-[var(--p-muted)]">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "light" | "ghost" | "danger"; small?: boolean };
export function PButton({ variant = "primary", small = false, className = "", children, ...rest }: BtnProps) {
  const look = {
    primary: "bg-[var(--p-primary)] text-white hover:brightness-95",
    light: "bg-[#eef1f5] text-[var(--p-ink)] hover:bg-[#e3e8ee]",
    ghost: "bg-transparent text-[var(--p-primary)] hover:bg-[var(--p-primary-soft)]",
    danger: "bg-[var(--p-danger-soft)] text-[var(--p-danger)] hover:brightness-95",
  }[variant];
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-[transform,filter,background-color] duration-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary)] ${small ? "min-h-[34px] px-3 text-[0.8rem]" : "min-h-[40px] px-4 text-[0.88rem]"} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function PageTitle({ title, crumbs, children }: { title: string; crumbs: string[]; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-[var(--p-ink)]">{title}</h1>
        <nav aria-label="Breadcrumb" className="mt-1 text-[0.8rem] text-[var(--p-muted)]">
          {crumbs.map((c, i) => <span key={c}>{i > 0 && <span aria-hidden className="mx-1.5">/</span>}{c}</span>)}
        </nav>
      </div>
      {children}
    </div>
  );
}

/** A centred dialog over a dimmed page. Escape and a click outside close it. */
export function PModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.button aria-label="Close dialog" className="absolute inset-0 bg-[#181c32]/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[86dvh] w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(24,28,50,0.28)]" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}>
            <header className="flex items-center justify-between gap-3 border-b border-[var(--p-line)] px-5 py-3.5">
              <h2 className="text-[1rem] font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef1f5]"><X size={16} /></button>
            </header>
            <div className="max-h-[calc(86dvh-60px)] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
