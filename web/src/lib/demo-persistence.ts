/** A confirmed plan may be labelled saved only after a real storage write. */
export function persistDemoSnapshot(
  getStorage: () => { setItem(key: string, value: string): void },
  key: string,
  snapshot: unknown,
): boolean {
  try {
    getStorage().setItem(key, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
