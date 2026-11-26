"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, GraduationCap, Home, Mail, MoreHorizontal, Moon, Plug, RotateCcw, Sparkles, Sun, Undo2 } from "lucide-react";
import { useApp } from "@/lib/state";
import { SPRING, useMediaQuery } from "@/lib/hooks";
import { Sheet } from "@/components/ui/Sheet";
import { DemoBadge } from "@/components/ui/kit";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { UpdatesBanner } from "./UpdatesBanner";
import { AskaTicketSheet } from "@/components/helpdesk/AskaTicketSheet";
import { EventApplicationSheet } from "@/components/events/EventApplicationSheet";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/hub", label: "Student hub", icon: GraduationCap },
  { href: "/mail", label: "Mail assistant", icon: Mail },
  { href: "/connections", label: "Connections", icon: Plug },
] as const;

const TABS = ["/", "/hub", "/mail"];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { openAgent, agentOpen, closeAgent, theme, setTheme, toast, resetDemo, askaDraft, closeAskaTicket, eventDraft, closeEventApplication } = useApp();
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === path; // the sheet belongs to the page it was opened on, so navigating closes it
  const setMore = (v: boolean) => setMoreAt(v ? path : null);
  const fullBleed = false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (agentOpen) closeAgent(); else openAgent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agentOpen, openAgent, closeAgent]);

  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const dark = theme === "dark" || (theme === "system" && prefersDark);

  // The presenter console is its own window: no student navigation, no assistant, no banner.
  if (path.startsWith("/demo")) return <main id="main">{children}</main>;

  return (
    <div className="min-h-dvh lg:pl-[272px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg">Skip to content</a>

      {/* Sidebar (desktop): a heavier material separates structure from content */}
      <aside className="glass-thick fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col rounded-[28px] p-3 lg:flex" aria-label="Primary">
        <Link href="/" className="press mb-3 flex items-center gap-3 rounded-2xl px-3 py-3">
          <Image
            src="/brand/corn-prawn-logo.png"
            alt="XMUM Compass corn and prawn mascots"
            width={48}
            height={48}
            priority
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="leading-tight">
            <span className="block text-[1.05rem] font-bold tracking-[-0.02em]">XMUM Compass</span>
            <span className="t-caption">Student super-app</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = active(path, href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className="press relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium tracking-[-0.006em]" style={{ color: on ? "var(--accent)" : "var(--label)" }}>
                {on && <motion.span layoutId="nav-pill" transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="absolute inset-0 rounded-xl bg-accent-soft" />}
                <Icon size={19} strokeWidth={on ? 2.4 : 1.9} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <button onClick={() => openAgent()} className="press mt-2 flex min-h-[48px] items-center gap-3 rounded-2xl bg-accent px-4 text-accent-fg">
          <Sparkles size={18} strokeWidth={2.4} />
          <span className="flex-1 text-left font-semibold tracking-[-0.01em]">Ask Compass</span>
          <kbd className="rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[0.7rem]">⌘K</kbd>
        </button>
        <button onClick={resetDemo} className="press mt-2 flex min-h-[36px] items-center justify-center gap-2 rounded-xl text-[0.8rem] font-semibold text-label-2"><RotateCcw size={14} /> Reset demo</button>
        <div className="mt-1 flex items-center justify-between px-1">
          <DemoBadge />
          <button aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")} className="press grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-label-2">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </aside>

      <main id="main" className={fullBleed ? "" : "mx-auto w-full max-w-[1240px] px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10"}>
        {children}
      </main>

      {/* Tab bar (phone): translucent layer, content scrolls under it */}
      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex min-w-0 items-center justify-between overflow-hidden rounded-[26px] px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 lg:hidden" style={{ width: "calc(100vw - 1.5rem)" }} aria-label="Primary">
        {NAV.filter((n) => TABS.includes(n.href)).map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link key={href} href={href} aria-label={label} aria-current={on ? "page" : undefined} className="press flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-semibold" style={{ color: on ? "var(--accent)" : "var(--label-2)" }}>
              <Icon size={22} strokeWidth={on ? 2.4 : 1.9} />
              <span className="max-w-full break-all text-center leading-tight">{label.replace("Campus map", "Map")}</span>
            </Link>
          );
        })}
        <button onClick={() => setMore(true)} className="press flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-semibold" style={{ color: !TABS.includes(path) && path !== "/" ? "var(--accent)" : "var(--label-2)" }}>
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>

      {/* Ask button (phone) */}
      <AnimatePresence>
        {!agentOpen && (
          <motion.button initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} onClick={() => openAgent()} aria-label="Ask Compass" className="press fixed bottom-[92px] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-accent pl-4 pr-5 text-accent-fg shadow-lg lg:hidden" style={{ boxShadow: "var(--shadow-md)" }}>
            <Sparkles size={20} strokeWidth={2.4} /> <span className="font-semibold">Ask</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={more} onClose={() => setMore(false)} label="More">
        <div className="overflow-y-auto px-4 pb-8 pt-2">
          <h2 className="t-headline px-2 pb-3">More</h2>
          <div className="grid grid-cols-2 gap-2">
            {NAV.filter((n) => !TABS.includes(n.href)).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="press flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface p-4 font-semibold">
                <Icon size={20} className="text-accent" /> {label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface p-4">
            <span className="flex items-center gap-2 font-medium">{dark ? <Moon size={18} /> : <Sun size={18} />} Appearance</span>
            <div className="flex gap-1">
              {(["system", "light", "dark"] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} aria-pressed={theme === t} className="press min-h-[34px] rounded-full px-3 text-[0.8rem] font-semibold capitalize" style={{ background: theme === t ? "var(--accent-soft)" : "var(--surface-3)", color: theme === t ? "var(--accent)" : "var(--label-2)" }}>{t}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { resetDemo(); setMoreAt(null); }} className="press mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-surface font-semibold text-label-2"><RotateCcw size={16} /> Reset demo</button>
          <div className="mt-4 flex justify-center"><DemoBadge /></div>
        </div>
      </Sheet>

      <UpdatesBanner />
      <AgentPanel />
      <AskaTicketSheet draft={askaDraft} onClose={closeAskaTicket} />
      <EventApplicationSheet draft={eventDraft} onClose={closeEventApplication} />

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} role="status" initial={{ y: 30, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={SPRING} className="glass-thick fixed bottom-[96px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-5 pr-2 text-[0.9rem] font-medium lg:bottom-6">
            {toast.text}
            {toast.undo && <button onClick={toast.undo} className="press btn btn-sm btn-tint"><Undo2 size={14} /> Undo</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { BookOpen };
