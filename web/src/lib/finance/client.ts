import { formatIdList, HDR_EVENTS } from "../world/headers.ts";
import { sanitizeLedger, type LedgerEntry } from "./ledger.ts";

/** What the finance system says about the student's account. The pages and the assistant read it only through this adapter. */
export async function fetchLedger(events: string[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ entries: LedgerEntry[]; outstanding: number }> {
  const response = await fetcher("/api/mock/finance/ledger", { headers: { [HDR_EVENTS]: formatIdList(events) }, cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 503 ? "The finance system is unavailable right now." : "The finance system did not answer.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("The finance system sent something unreadable.");
  const entries = sanitizeLedger((body as { entries?: unknown }).entries);
  const owed = (body as { outstanding?: unknown }).outstanding;
  return { entries, outstanding: typeof owed === "number" && Number.isFinite(owed) ? owed : 0 };
}
