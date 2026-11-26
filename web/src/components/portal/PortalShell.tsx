"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CalendarClock, ClipboardList, ExternalLink, FileDown, LayoutDashboard, LibraryBig, LifeBuoy, Mail, Megaphone, Menu, ReceiptText, RotateCcw, X } from "lucide-react";
import { resetScenario } from "@/lib/world/storage";
import { PORTAL_VARS, PButton } from "./ui";
import { useTriggered } from "./useScenario";

const NAV = [
  { section: "E-Services", items: [{ href: "/demo", label: "Announcements", hint: "Scenario events", icon: Megaphone }] },
  { section: "Student Portal", items: [{ href: "/demo/student-portal", label: "Dashboard", hint: "Alerts and balance", icon: LayoutDashboard }, { href: "/demo/student-portal/account-status", label: "Account Status", hint: "Invoices and receipts", icon: ReceiptText }, { href: "/demo/student-portal/files", label: "Download File", hint: "PDF files", icon: FileDown }] },
  { section: "Teaching", items: [{ href: "/demo/lecturer", label: "Replacement Classes", hint: "Find a time for a lost class", icon: CalendarClock }] },
  { section: "Space Booking", items: [{ href: "/demo/library", label: "Library Rooms", hint: "Availability desk", icon: LibraryBig }] },
  { section: "Extracurricular", items: [{ href: "/demo/eca", label: "Event Applications", hint: "Club events, rooms and items", icon: ClipboardList }] },
  { section: "Help desk", items: [{ href: "/demo/aska", label: "AskA", hint: "Hostel tickets", icon: LifeBuoy }] },
  { section: "Mailbox", items: [{ href: "/demo/mail", label: "Campus Email", hint: "Inbox and New message", icon: Mail }] },
] as const;

/**
 * The presenter's window. It borrows the structure of a university e-services portal so it feels like a real
 * system you can pretend to be, but it has no real name, crest or link, and says so on every page.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/demo";
  const [open, setOpen] = useState(false);
  const triggered = useTriggered();
  const active = (href: string) => (href === "/demo" || href === "/demo/student-portal" ? path === href : path.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--p-sidebar)] text-[var(--p-sidebar-ink)]">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--p-primary)] text-[0.8rem] font-bold text-white" aria-hidden>ES</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.95rem] font-semibold text-white">E-Services Portal</p>
          <p className="text-[0.72rem]">Demo console</p>
        </div>
      </div>
      <nav aria-label="Console sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.section} className="mt-3">
            <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#6d6f87]">{group.section}</p>
            {group.items.map(({ href, label, hint, icon: Icon }) => {
              const on = active(href);
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined} className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[0.9rem] font-medium transition-colors ${on ? "bg-[#2b2b40] text-white" : "hover:bg-[#262638] hover:text-white"}`}>
                  <Icon size={18} className={on ? "text-[#5aa2ff]" : ""} />
                  <span className="min-w-0 flex-1"><span className="block truncate">{label}</span></span>
                  {href === "/demo" && triggered.length > 0 && <span className="rounded-full bg-[var(--p-primary)] px-2 py-0.5 text-[0.7rem] font-semibold text-white" aria-label={`${triggered.length} events triggered`}>{triggered.length}</span>}
                  <span className="sr-only">{hint}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <p className="border-t border-[#2b2b40] px-5 py-4 text-[0.72rem] leading-snug">Fictional demo data. Not a real university system, and not connected to one.</p>
    </div>
  );

  return (
    <div style={PORTAL_VARS} className="min-h-dvh bg-[var(--p-bg)] text-[var(--p-ink)] lg:pl-[264px]">
      <a href="#portal-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.button aria-label="Close menu" key="scrim" className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside key="drawer" role="dialog" aria-modal="true" aria-label="Console menu" className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[86vw] lg:hidden" initial={{ x: "-104%" }} animate={{ x: 0 }} exit={{ x: "-104%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}>
              {sidebar}
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#2b2b40] text-white"><X size={17} /></button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--p-line)] bg-white/90 px-4 py-2 backdrop-blur sm:px-6">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg bg-[#eef1f5] lg:hidden"><Menu size={19} /></button>
        <span className="rounded-md border border-[#f1c76b] bg-[var(--p-warn-soft)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--p-warn)]">Demo console, fictional data</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden text-[0.82rem] text-[var(--p-muted)] sm:inline">Signed in as <strong className="text-[var(--p-ink)]">Presenter</strong></span>
          <a href="/" target="_blank" rel="noopener" className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#eef1f5] px-3 text-[0.8rem] font-semibold hover:bg-[#e3e8ee]">Open Compass <ExternalLink size={13} /></a>
          <PButton small variant="danger" onClick={() => resetScenario()}><RotateCcw size={13} /> Reset scenario</PButton>
        </div>
      </header>

      <main id="portal-main" className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
