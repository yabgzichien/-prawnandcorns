"use client";

import { useMemo } from "react";
import { buildTimeline, type TimelineItem } from "@/lib/calendar/timeline";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";

/** Everything on the master calendar. What this browser holds is read only after storage has loaded, so the first paint matches the server. */
export function useTimeline(): TimelineItem[] {
  const { hydrated, submitted, studySessions, reminders, personalEvents, todos, bookings } = useApp();
  const { data } = useCampus();
  return useMemo(() => buildTimeline({
    classes: data.classes, assignments: data.assignments, submitted, dues: data.fees.dues, currency: data.fees.currency,
    ...(hydrated ? { studySessions, reminders, personalEvents, todos, bookings } : {}),
  }), [data.classes, data.assignments, data.fees.dues, data.fees.currency, submitted, hydrated, studySessions, reminders, personalEvents, todos, bookings]);
}
