"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CUSTOM_MAIL_KEY, SCENARIO_KEY, cleanLocalList, sanitizeCustomNotices, subscribeScenario } from "@/lib/world/storage";

/** A stored string is a stable snapshot, so React re-renders only when the text really changes. */
const raw = (key: string) => () => { try { return localStorage.getItem(key) ?? "[]"; } catch { return "[]"; } };
export const useStored = (key: string): string => useSyncExternalStore(subscribeScenario, raw(key), () => "[]");

/** Event ids triggered so far, in order. Updates when either window changes them. */
export function useTriggered(): string[] {
  const text = useStored(SCENARIO_KEY);
  return useMemo(() => cleanLocalList(text), [text]);
}

export function useCustomEmails() {
  const text = useStored(CUSTOM_MAIL_KEY);
  return useMemo(() => { try { return sanitizeCustomNotices(JSON.parse(text)); } catch { return []; } }, [text]);
}
