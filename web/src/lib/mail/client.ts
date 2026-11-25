import { formatIdList, HDR_EVENTS } from "../world/headers.ts";

/** The university mail system, as the demo webmail talks to it. Only these two calls. */
type Message = { id: string; from: string; address?: string; subject: string; date: string; preview: string };

const get = async (url: string, events: string[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<unknown> => {
  const response = await fetcher(url, { headers: { [HDR_EVENTS]: formatIdList(events) }, cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 404 ? "That message is no longer in the inbox." : "The mail system did not answer.");
  return response.json();
};

export async function fetchMailList(events: string[], signal?: AbortSignal, fetcher?: typeof fetch): Promise<Message[]> {
  const body = await get("/api/mock/mail/messages", events, signal, fetcher);
  const list = body && typeof body === "object" ? (body as { messages?: unknown }).messages : undefined;
  if (!Array.isArray(list)) throw new Error("The mail system sent something unreadable.");
  return list.filter((m): m is Message => !!m && typeof m === "object" && typeof (m as Message).id === "string" && typeof (m as Message).subject === "string" && typeof (m as Message).from === "string" && typeof (m as Message).date === "string" && typeof (m as Message).preview === "string").slice(0, 60);
}

export async function fetchMailBody(id: string, events: string[], signal?: AbortSignal, fetcher?: typeof fetch): Promise<string> {
  const body = await get(`/api/mock/mail/messages/${encodeURIComponent(id)}`, events, signal, fetcher);
  const text = body && typeof body === "object" ? (body as { message?: { body?: unknown } }).message?.body : undefined;
  if (typeof text !== "string") throw new Error("The mail system sent something unreadable.");
  return text.slice(0, 4000);
}
