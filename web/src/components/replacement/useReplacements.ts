"use client";

import { useCallback, useMemo } from "react";
import { useStored } from "@/components/portal/useScenario";
import { COURSE_BY_ID } from "@/lib/data/academics";
import { LECTURER } from "@/lib/replacement/cohort";
import { markSeen, parseAnswers, parseSeen, seenStamp } from "@/lib/replacement/storage";
import { slotLabel } from "@/lib/replacement/time";
import { REPLACEMENT_ANSWERS_KEY, REPLACEMENT_SEEN_KEY, type ReplacementRequest } from "@/lib/replacement/types";
import { useCampus } from "@/lib/sync/CampusProvider";

export function useReplacementAnswers() {
  const text = useStored(REPLACEMENT_ANSWERS_KEY);
  return useMemo(() => parseAnswers(text), [text]);
}

export function alertText(r: ReplacementRequest): string {
  const code = COURSE_BY_ID[r.courseId]?.code ?? r.courseId;
  if (r.status === "scheduled" && r.chosen) return `${code} replacement class set: ${slotLabel(r.chosen)} in ${r.chosen.room}.`;
  return `${LECTURER.name} asks which times work for a ${code} replacement class.`;
}

/** Replacement updates the student has not been told about yet, and a way to mark them as told. */
export function useReplacementAlerts() {
  const { replacements } = useCampus();
  const seenText = useStored(REPLACEMENT_SEEN_KEY);
  const seen = useMemo(() => parseSeen(seenText), [seenText]);
  const alerts = useMemo(() => replacements.filter((r) => seen[r.id] !== seenStamp(r)), [replacements, seen]);
  const mark = useCallback(() => { if (alerts.length) markSeen(alerts); }, [alerts]);
  return { alerts, markSeen: mark };
}
