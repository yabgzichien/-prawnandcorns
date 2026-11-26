"use client";

import { useCallback, useMemo } from "react";
import { useStored } from "@/components/portal/useScenario";
import { sanitizeApplications } from "@/lib/events/application";
import { decisionStamp, parseDecisions, sanitizeSeen } from "@/lib/events/decisions";
import { SEEDED_APPLICATIONS } from "@/lib/events/seed";
import { withSeeded } from "@/lib/events/storage";
import { DECISIONS_KEY, EVENTS_SEEN_KEY, type Decisions, type EventApplication } from "@/lib/events/types";

const STATE_KEY = "xmum-compass:v1";

/** What the ECA desk has said, plus the invented answers to the other clubs' older applications. */
export function useDecisions(): Decisions {
  const text = useStored(DECISIONS_KEY);
  return useMemo(() => withSeeded(parseDecisions(text)), [text]);
}

/**
 * The student's saved applications, the other clubs' invented ones, and what the ECA desk has said. It reads
 * saved data, so it works in the Compass window and in the console and stays in step between them.
 */
export function useEventData(): { mine: EventApplication[]; all: EventApplication[]; decisions: Decisions } {
  const saved = useStored(STATE_KEY);
  const decisions = useDecisions();
  const mine = useMemo(() => {
    try { const v: unknown = JSON.parse(saved); return sanitizeApplications(v && typeof v === "object" && !Array.isArray(v) ? (v as { eventApplications?: unknown }).eventApplications : []); } catch { return []; }
  }, [saved]);
  const all = useMemo(() => [...SEEDED_APPLICATIONS, ...mine], [mine]);
  return { mine, all, decisions };
}

/** Decisions the student has not been told about yet, and a way to mark them as told. Compass writes the seen key. */
export function useEventAlerts(mine: readonly EventApplication[]) {
  const decisions = useDecisions();
  const seenText = useStored(EVENTS_SEEN_KEY);
  const seen = useMemo(() => { try { return sanitizeSeen(JSON.parse(seenText)); } catch { return {}; } }, [seenText]);
  const alerts = useMemo(() => mine.flatMap((app) => { const stamp = decisionStamp(app, decisions); return stamp && seen[app.id] !== stamp ? [{ app, stamp }] : []; }), [mine, decisions, seen]);
  const markSeen = useCallback(() => {
    const next: Record<string, string> = { ...seen };
    for (const a of alerts) next[a.app.id] = a.stamp;
    try { localStorage.setItem(EVENTS_SEEN_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("compass:scenario-changed")); } catch {}
  }, [alerts, seen]);
  return { alerts, markSeen };
}
