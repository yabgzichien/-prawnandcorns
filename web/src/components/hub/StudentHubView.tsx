"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, CheckSquare, ChevronDown, Landmark, Library, MapPin, Users, X } from "lucide-react";
import { AssignmentsView } from "@/components/pages/AssignmentsView";
import { ClubsView } from "@/components/pages/ClubsView";
import { CoursesView } from "@/components/pages/CoursesView";
import { FinanceView } from "@/components/pages/FinanceView";
import { LibraryView } from "@/components/library/LibraryView";
import { TimetableView } from "@/components/pages/TimetableView";
import { MapView } from "@/components/map/MapView";
import { DemoBadge } from "@/components/ui/kit";
import { SPRING } from "@/lib/hooks";

const SECTIONS = [
  { id: "timetable", title: "Timetable", summary: "3 classes today", description: "Your week, class changes and calendar export.", icon: CalendarDays, tone: "green" },
  { id: "assignments", title: "Assignments", summary: "2 deadlines this week", description: "Track coursework, deadlines and Moodle status.", icon: CheckSquare, tone: "cream" },
  { id: "map", title: "Campus map", summary: "Find rooms and facilities", description: "Search buildings, rooms and key campus places.", icon: MapPin, tone: "green" },
  { id: "courses", title: "Courses", summary: "5 courses this semester", description: "See your semester, degree outlook and GE credits.", icon: BookOpen, tone: "cream" },
  { id: "clubs", title: "Clubs & events", summary: "Discover your community", description: "Browse events, clubs and activities around campus.", icon: Users, tone: "green" },
  { id: "finance", title: "Finance", summary: "Fees and payment dates", description: "Review balances, instalments and payment history.", icon: Landmark, tone: "cream" },
  { id: "library", title: "Library rooms", summary: "Book a study room", description: "Reserve a study or discussion room and see where it is.", icon: Library, tone: "green" },
] as const;

export type HubSection = (typeof SECTIONS)[number]["id"];

const isSection = (value: string | null): value is HubSection => SECTIONS.some((section) => section.id === value);

export function StudentHubView() {
  const params = useSearchParams();
  const selected = isSection(params.get("section")) ? params.get("section") as HubSection : null;
  const compact = selected !== null;

  const select = (id: HubSection | null) => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set("section", id); else next.delete("section");
    window.history.pushState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}`);
  };

  return (
    <div className="hub-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-1 sm:mb-8">
        <div>
          <div className="mb-2 flex items-center gap-3"><p className="t-eyebrow">Your campus, in one place</p><DemoBadge /></div>
          <h1 className="t-display">Student hub</h1>
          <p className="t-sub mt-2 max-w-2xl">Choose a section to bring its full workspace into focus.</p>
        </div>
        {selected && (
          <button onClick={() => select(null)} className="press btn btn-plain" aria-label="Collapse selected section">
            <X size={16} /> Collapse
          </button>
        )}
      </header>

      <motion.div layout className={`hub-grid ${compact ? "is-compact" : ""}`} aria-label="Student hub sections">
        {SECTIONS.map(({ id, title, summary, description, icon: Icon, tone }) => {
          const active = selected === id;
          return (
            <motion.button
              layout
              key={id}
              type="button"
              onClick={() => select(active ? null : id)}
              aria-expanded={active}
              aria-controls="hub-content"
              aria-pressed={active}
              className={`hub-tile press hub-tile-${tone} ${active ? "is-selected" : ""}`}
              transition={SPRING}
            >
              <motion.span layout className="hub-tile-icon"><Icon aria-hidden /></motion.span>
              <motion.span layout className="hub-tile-copy">
                <span className="hub-tile-title">{title}</span>
                <span className="hub-tile-summary">{compact ? summary : description}</span>
              </motion.span>
              <motion.span layout className="hub-tile-chevron" aria-hidden><ChevronDown /></motion.span>
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence initial={false}>
        {selected ? (
          <motion.section
            id="hub-content"
            key="hub-content"
            aria-live="polite"
            aria-label={`${SECTIONS.find((section) => section.id === selected)?.title} details`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={SPRING}
            className="hub-content-panel"
          >
            <div hidden={selected !== "timetable"}><TimetableView /></div>
            <div hidden={selected !== "assignments"}><AssignmentsView /></div>
            <div hidden={selected !== "map"}><MapView embedded /></div>
            <div hidden={selected !== "courses"}><CoursesView /></div>
            <div hidden={selected !== "clubs"}><ClubsView /></div>
            <div hidden={selected !== "finance"}><FinanceView /></div>
            {selected === "library" && <LibraryView />}
          </motion.section>
        ) : (
          <motion.p key="hub-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex items-center gap-2 px-1 text-sm text-label-2">
            Select a tile to open its details below.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
