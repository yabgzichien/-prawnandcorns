/**
 * Keep the Gemini endpoint protected from browser cross-site requests.
 * Next.js may normalize a local route's request.url to `localhost` even when
 * the browser reached the same server through `127.0.0.1` or `[::1]`.
 */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isAllowedAgentOrigin(origin: string | null, requestUrl: string, remoteEnabled: boolean): boolean {
  // Non-browser clients might omit Origin; keep CLI smoke tests possible.
  if (origin === null) return true;

  try {
    const source = new URL(origin);
    const target = new URL(requestUrl);
    // Reject malformed Origin values including paths or credential syntax.
    if (source.origin === "null" || origin !== source.origin) return false;
    if (source.origin === target.origin) return true;

    // Only locally, accept different loopback aliases for the *same server*.
    // The port and scheme still must match. Never allow public domains here.
    return !remoteEnabled &&
      LOCAL_HOSTNAMES.has(source.hostname) && LOCAL_HOSTNAMES.has(target.hostname) &&
      source.port === target.port && source.protocol === target.protocol;
  } catch {
    return false;
  }
}
