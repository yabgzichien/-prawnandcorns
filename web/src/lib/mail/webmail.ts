import { DEMO_NOW, dateShort, dayShort, timeOf } from "../time.ts";

/** Pure helpers behind the demo webmail screen: building the list, searching, reading state and keyboard steps. */

export type MailItem = {
  id: string;
  from: string;
  address?: string;
  subject: string;
  date: string; // ISO
  preview: string;
  /** Typed into the console by the presenter. Always read by Compass as untrusted content. */
  custom?: boolean;
  /** Full text, for custom emails (the mail system is asked for the rest). */
  body?: string;
};

type ListMessage = { id: string; from: string; address?: string; subject: string; date: string; preview: string };
type Custom = { id: string; from: string; subject: string; body: string; date: string };

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Newest first. The mail system's messages and the emails the presenter typed in, side by side. */
export function toItems(messages: readonly ListMessage[], custom: readonly Custom[]): MailItem[] {
  const fromApi = messages.map((m): MailItem => ({ id: m.id, from: m.from, address: m.address, subject: m.subject, date: m.date, preview: m.preview }));
  const typed = custom.map((c): MailItem => ({ id: `mail:${c.id}`, from: c.from, subject: c.subject, date: c.date, preview: squash(c.body).slice(0, 110), custom: true, body: c.body }));
  return [...fromApi, ...typed].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
}

/** The welcome and add/drop emails were there before the demo started, so they begin as read. */
export const isUnread = (id: string, read: ReadonlySet<string>): boolean => !id.startsWith("mail-b") && !read.has(id);

export function filterMail(items: readonly MailItem[], query: string, unreadOnly: boolean, read: ReadonlySet<string>): MailItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((m) => (!unreadOnly || isUnread(m.id, read)) && (!q || `${m.from} ${m.subject} ${m.preview}`.toLowerCase().includes(q)));
}

/** One step up or down the list. With nothing selected, down picks the first and up picks the last. Never wraps. */
export function stepSelection(ids: readonly string[], current: string | null, dir: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = current === null ? -1 : ids.indexOf(current);
  if (i === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[Math.min(ids.length - 1, Math.max(0, i + dir))];
}

export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const pick = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return pick.toUpperCase();
}

/** A stable colour slot, 0 to 5, so a sender keeps the same avatar colour. */
export function avatarTone(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6;
}

/** "13:25" for today in the demo, otherwise "Fri 20 Nov". */
export function whenLabel(iso: string, now: Date = DEMO_NOW): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const sameDay = new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10) === new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  return sameDay ? timeOf(d) : `${dayShort(d)} ${dateShort(d)}`;
}

export const fullWhen = (iso: string): string => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}` : ""; };
