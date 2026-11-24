import { formatIdList, HDR_EVENTS } from "../world/headers.ts";
import type { libraryRooms } from "../world/payloads.ts";

/** What the library booking system says about one day. The page talks to it only through this adapter. */
export type LibraryDay = NonNullable<ReturnType<typeof libraryRooms>>;

export async function fetchLibraryDay(date: string, events: string[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<LibraryDay> {
  const response = await fetcher(`/api/mock/library/rooms?date=${encodeURIComponent(date)}`, { headers: { [HDR_EVENTS]: formatIdList(events) }, cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 404 ? "The library does not list that day." : "The library booking system did not answer.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !Array.isArray((body as LibraryDay).rooms)) throw new Error("The library sent something unreadable.");
  return body as LibraryDay;
}
