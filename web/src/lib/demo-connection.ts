/** A cancellable walkthrough for the fictional Moodle integration. */
export function runDemoConnection(
  onPhase: (phase: "sync" | "done") => void,
  onConnected: () => void,
  clock: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis,
): () => void {
  let active = true;
  const syncTimer = clock.setTimeout(() => {
    if (active) onPhase("sync");
  }, 1300);
  const doneTimer = clock.setTimeout(() => {
    if (active) {
      onPhase("done");
      onConnected();
    }
  }, 2700);
  return () => {
    active = false;
    clock.clearTimeout(syncTimer);
    clock.clearTimeout(doneTimer);
  };
}
