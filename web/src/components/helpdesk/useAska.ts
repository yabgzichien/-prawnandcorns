"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ASKA_SEEN_KEY, ASKA_UPDATES_KEY, sanitizeUpdates, type AskaTicket, type AskaUpdates } from "@/lib/aska";
import { SCENARIO_CHANGED, subscribeStorage } from "@/lib/world/storage";

const subscribe = (fn: () => void) => subscribeStorage([ASKA_UPDATES_KEY, ASKA_SEEN_KEY], fn);
const read = (key: string) => () => { try { return localStorage.getItem(key) ?? "{}"; } catch { return "{}"; } };
const parse = (text: string): unknown => { try { return JSON.parse(text); } catch { return {}; } };

/** What the help desk has done with the student's tickets. The console window writes it. */
export function useAskaUpdates(): AskaUpdates {
  const text = useSyncExternalStore(subscribe, read(ASKA_UPDATES_KEY), () => "{}");
  return useMemo(() => sanitizeUpdates(parse(text)), [text]);
}

/** Ticket updates the student has not been told about yet, and a way to mark them as told. */
export function useAskaAlerts(tickets: readonly AskaTicket[]) {
  const updates = useAskaUpdates();
  const seenText = useSyncExternalStore(subscribe, read(ASKA_SEEN_KEY), () => "{}");
  const seen = useMemo(() => { const v = parse(seenText); return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, string> : {}; }, [seenText]);
  const alerts = useMemo(() => tickets.flatMap((t) => { const u = updates[t.id]; return u && u.status !== "Submitted" && seen[t.id] !== u.status ? [{ ticket: t, update: u }] : []; }), [tickets, updates, seen]);
  const markSeen = useCallback(() => {
    const next: Record<string, string> = { ...seen };
    for (const a of alerts) next[a.ticket.id] = a.update.status;
    try { localStorage.setItem(ASKA_SEEN_KEY, JSON.stringify(next)); window.dispatchEvent(new Event(SCENARIO_CHANGED)); } catch {}
  }, [alerts, seen]);
  return { alerts, markSeen };
}
