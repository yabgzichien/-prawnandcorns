/**
 * Remembers whether the first-run connection sheet has been finished or skipped. Saved in this browser only.
 * If storage is blocked, the answer is kept for the current page session so the sheet does not keep returning.
 */
export const ONBOARDING_KEY = "compass:onboarding:v1";
export const ONBOARDING_EVENT = "compass:onboarding";

export type OnboardingState = "none" | "done" | "skipped";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let remembered: OnboardingState | null = null;

function store(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ONBOARDING_EVENT));
}

export function readOnboarding(storage: StorageLike | null = store()): OnboardingState {
  try {
    const value = storage?.getItem(ONBOARDING_KEY);
    if (value === "done" || value === "skipped") return value;
  } catch { /* fall through to the session answer */ }
  return remembered ?? "none";
}

/** Returns false when the answer could only be kept for this page session. */
export function writeOnboarding(value: "done" | "skipped", storage: StorageLike | null = store()): boolean {
  let saved = false;
  try {
    if (storage) { storage.setItem(ONBOARDING_KEY, value); saved = true; }
  } catch { saved = false; }
  remembered = saved ? null : value;
  announce();
  return saved;
}

/** Called by Reset demo so the next run starts with the connection sheet again. */
export function clearOnboarding(storage: StorageLike | null = store()): void {
  remembered = null;
  try { storage?.removeItem(ONBOARDING_KEY); } catch { /* nothing to clear */ }
  announce();
}

export function subscribeOnboarding(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === ONBOARDING_KEY) fn(); };
  window.addEventListener(ONBOARDING_EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(ONBOARDING_EVENT, fn); window.removeEventListener("storage", onStorage); };
}
