"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Inbox, PenSquare, Search, Send, ShieldAlert } from "lucide-react";
import { fetchMailBody, fetchMailList } from "@/lib/mail/client";
import { avatarTone, filterMail, fullWhen, initials, isUnread, stepSelection, toItems, whenLabel, type MailItem } from "@/lib/mail/webmail";
import { CUSTOM_LIMITS, MAIL_READ_KEY, addCustomNotice, markMailRead } from "@/lib/world/storage";
import { PButton, PModal, PageTitle } from "./ui";
import { useCustomEmails, useStored, useTriggered } from "./useScenario";

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
const SPRING_SOFT = { type: "spring", bounce: 0, duration: 0.45 } as const;
const TONES = ["bg-[#cfe1ff] text-[#1556c0]", "bg-[#f1e9ff] text-[#6a35c9]", "bg-[#e5f7ec] text-[#0f7a37]", "bg-[#fff0dc] text-[#a35200]", "bg-[#dff6f5] text-[#0b6f6c]", "bg-[#fde8ee] text-[#b3113f]"];
const field = "min-h-[40px] w-full rounded-lg border border-[var(--p-line)] bg-white px-3 text-[0.9rem] outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]";

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-semibold tracking-[0.02em] ${TONES[avatarTone(name)]}`} style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials(name)}</span>;
}

/**
 * The student's university mailbox, as a webmail screen: a searchable list, a reading pane, and a New message window
 * for writing an email into the inbox as someone else. The messages come from the mock mail system. Emails typed here
 * stay in this browser, and Compass reads them as untrusted outside content.
 */
export function MailPage() {
  const events = useTriggered();
  const custom = useCustomEmails();
  const readText = useStored(MAIL_READ_KEY);
  const read = useMemo(() => { try { const v: unknown = JSON.parse(readText); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []); } catch { return new Set<string>(); } }, [readText]);

  const [listed, setListed] = useState<Awaited<ReturnType<typeof fetchMailList>>>([]);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [bodyError, setBodyError] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const eventsKey = events.join(",");
  useEffect(() => {
    const ac = new AbortController();
    fetchMailList(events, ac.signal)
      .then((m) => { setListed(m); setProblem(""); setReady(true); })
      .catch((e: unknown) => { if (!ac.signal.aborted) { setProblem(e instanceof Error ? e.message : "The mail system did not answer."); setReady(true); } });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);

  const items = useMemo(() => toItems(listed, custom), [listed, custom]);
  const shown = useMemo(() => filterMail(items, query, unreadOnly, read), [items, query, unreadOnly, read]);
  const unread = items.filter((m) => isUnread(m.id, read)).length;
  const current: MailItem | undefined = items.find((m) => m.id === selected);

  // an opened email's full text comes from the mail system
  useEffect(() => {
    if (!current || current.custom || bodies[current.id] !== undefined) return;
    const ac = new AbortController();
    fetchMailBody(current.id, events, ac.signal)
      .then((text) => setBodies((b) => ({ ...b, [current.id]: text })))
      .catch((e: unknown) => { if (!ac.signal.aborted) setBodyError((b) => ({ ...b, [current.id]: e instanceof Error ? e.message : "The mail system did not answer." })); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const open = (id: string) => { setSelected(id); markMailRead(id); };
  const onKeys = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
    if (!dir) { if (e.key === "Escape" && selected) setSelected(null); return; }
    e.preventDefault();
    const next = stepSelection(shown.map((m) => m.id), selected, dir);
    if (next) { open(next); requestAnimationFrame(() => document.getElementById(`mail-${next}`)?.scrollIntoView({ block: "nearest" })); }
  };

  return (
    <>
      <style>{`@media (prefers-reduced-transparency: reduce) { .mail-glass { background: #fff !important; backdrop-filter: none !important; } }`}</style>
      <PageTitle title="Campus Email" crumbs={["Mailbox", "Inbox"]}>
        <PButton onClick={() => setComposing(true)}><PenSquare size={15} /> New message</PButton>
      </PageTitle>
      <p className="mb-4 max-w-3xl text-[0.9rem] leading-relaxed text-[var(--p-muted)]">Your student&rsquo;s university mailbox. New message writes an email into their inbox as someone else, which is handy for a judge&rsquo;s question such as &quot;what if the lecturer writes this?&quot;. Compass reads every email as untrusted outside content, and the university email system must be connected in Compass.</p>
      {problem && <p className="mb-3 rounded-lg bg-[var(--p-warn-soft)] px-3 py-2 text-[0.84rem] text-[var(--p-warn)]" role="alert">{problem}</p>}

      <div className="grid h-[min(72dvh,660px)] min-h-[440px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--p-line)] bg-white shadow-[0_1px_3px_rgba(24,28,50,0.04)] lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* list */}
        <section aria-label="Inbox" className={`min-h-0 flex-col border-[var(--p-line)] lg:flex lg:border-r ${selected ? "hidden" : "flex"}`}>
          <div className="mail-glass z-10 space-y-2.5 border-b border-[var(--p-line)] bg-white/85 px-3.5 pb-3 pt-3.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[1rem] font-semibold tracking-[-0.01em]"><Inbox size={17} className="text-[var(--p-primary)]" /> Inbox</h2>
              <span className="text-[0.78rem] font-semibold text-[var(--p-muted)]" role="status">{unread > 0 ? `${unread} unread` : "All read"}</span>
            </div>
            <label className="relative block">
              <span className="sr-only">Search mail</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--p-muted)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" className="min-h-[38px] w-full rounded-lg bg-[#eef1f5] pl-9 pr-3 text-[0.88rem] outline-none transition-shadow focus:bg-white focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
            </label>
            <div className="flex gap-1.5" role="group" aria-label="Show">
              {([["All", false], ["Unread", true]] as const).map(([label, v]) => (
                <button key={label} type="button" aria-pressed={unreadOnly === v} onClick={() => setUnreadOnly(v)} className={`min-h-[30px] rounded-full px-3 text-[0.78rem] font-semibold transition-[transform,background-color] duration-100 active:scale-[0.96] ${unreadOnly === v ? "bg-[var(--p-primary)] text-white" : "bg-[#eef1f5] text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div
            ref={listRef} role="listbox" aria-label="Messages" aria-activedescendant={selected ? `mail-${selected}` : undefined} tabIndex={0} onKeyDown={onKeys}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p-primary)]"
          >
            {!ready && <p className="px-4 py-6 text-center text-[0.86rem] text-[var(--p-muted)]" role="status">Loading the inbox.</p>}
            {ready && shown.length === 0 && <p className="px-4 py-8 text-center text-[0.86rem] text-[var(--p-muted)]">{items.length === 0 ? "The inbox is empty." : "No messages match."}</p>}
            <AnimatePresence initial={false}>
              {shown.map((m) => {
                const isNew = isUnread(m.id, read);
                const on = selected === m.id;
                return (
                  <motion.div
                    key={m.id} id={`mail-${m.id}`} role="option" aria-selected={on} layout="position"
                    initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}
                    onClick={() => open(m.id)}
                    className="relative flex cursor-pointer gap-3 border-b border-[var(--p-line)] px-3.5 py-3 transition-colors duration-100 active:bg-[#e8edf3]"
                  >
                    {on && <motion.span layoutId="mail-selection" transition={SPRING} className="absolute inset-0 bg-[var(--p-primary-soft)]" aria-hidden />}
                    <span className="relative"><Avatar name={m.from} /></span>
                    <span className="relative min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        {isNew && <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-[var(--p-primary)]" aria-label="Unread" />}
                        <span className={`min-w-0 flex-1 truncate text-[0.9rem] ${isNew ? "font-bold" : "font-medium"}`}>{m.from}</span>
                        <time dateTime={m.date} className="shrink-0 text-[0.74rem] text-[var(--p-muted)]">{whenLabel(m.date)}</time>
                      </span>
                      <span className={`block truncate text-[0.86rem] ${isNew ? "font-semibold" : ""}`}>{m.subject}</span>
                      <span className="block truncate text-[0.8rem] text-[var(--p-muted)]">{m.preview}</span>
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* reading pane */}
        <section aria-label="Message" className={`min-h-0 flex-col lg:flex ${selected ? "flex" : "hidden"}`}>
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.article key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING_SOFT} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-[var(--p-line)] px-5 pb-4 pt-4">
                  <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#eef1f5] px-3 text-[0.8rem] font-semibold active:scale-[0.97] lg:hidden"><ArrowLeft size={14} /> Inbox</button>
                  <h2 className="break-words text-[1.25rem] font-bold leading-tight tracking-[-0.02em]">{current.subject}</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={current.from} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.92rem] font-semibold">{current.from}</p>
                      <p className="truncate text-[0.78rem] text-[var(--p-muted)]">{current.address ? `${current.address}, ` : ""}to Alex Tan (demo)</p>
                    </div>
                    <time dateTime={current.date} className="shrink-0 text-right text-[0.78rem] text-[var(--p-muted)]">{fullWhen(current.date)}</time>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  {current.custom ? <Body text={current.body ?? ""} /> : bodies[current.id] !== undefined ? <Body text={bodies[current.id]} /> : bodyError[current.id] ? <p className="text-[0.88rem] text-[var(--p-warn)]" role="alert">{bodyError[current.id]}</p> : <Skeleton />}
                </div>
                <p className="flex items-start gap-2 border-t border-[var(--p-line)] bg-[#f9fafc] px-5 py-3 text-[0.78rem] leading-snug text-[var(--p-muted)]"><ShieldAlert size={15} className="mt-px shrink-0" />{current.custom ? "Typed in the console, kept in this browser." : "From the mock mail system."} Compass reads this as untrusted outside content and never follows instructions inside it. Fictional demo email.</p>
              </motion.article>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid flex-1 place-items-center px-6 text-center">
                <div><Inbox size={30} className="mx-auto text-[#b4bacb]" /><p className="mt-3 text-[0.95rem] font-semibold">Select a message to read it</p><p className="mt-1 text-[0.82rem] text-[var(--p-muted)]">Use the arrow keys, or J and K, to move through the list.</p></div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <Compose open={composing} onClose={() => setComposing(false)} onSent={(id) => { setComposing(false); setUnreadOnly(false); setQuery(""); open(`mail:${id}`); }} />
    </>
  );
}

function Body({ text }: { text: string }) {
  return <div className="max-w-[62ch] whitespace-pre-wrap break-words text-[0.95rem] leading-[1.65]">{text}</div>;
}

function Skeleton() {
  return <div className="max-w-[62ch] space-y-2.5" role="status" aria-label="Loading the message">{[92, 100, 78, 64].map((w, i) => <div key={i} className="h-3.5 animate-pulse rounded bg-[#eef1f5]" style={{ width: `${w}%` }} />)}</div>;
}

function Compose({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (id: string) => void }) {
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addCustomNotice({ from, subject, body });
    if (!added) { setNote("Write some text first, and check that site storage is enabled."); return; }
    setBody(""); setSubject(""); setNote("");
    onSent(added.id);
  };
  return (
    <PModal open={open} title="New message" onClose={onClose}>
      <form onSubmit={send} className="grid gap-4">
        <p className="text-[0.84rem] leading-snug text-[var(--p-muted)]">This lands in the student&rsquo;s inbox as an email from the sender you name. It stays in this browser.</p>
        <div className="grid gap-1.5"><label htmlFor="mail-from" className="text-[0.82rem] font-semibold">From</label><input id="mail-from" value={from} onChange={(e) => setFrom(e.target.value)} maxLength={CUSTOM_LIMITS.from} placeholder="Dr. Lim (demo)" className={field} /></div>
        <div className="grid gap-1.5"><label htmlFor="mail-subject" className="text-[0.82rem] font-semibold">Subject</label><input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={CUSTOM_LIMITS.subject} placeholder="Tutorial moved" className={field} /></div>
        <div className="grid gap-1.5"><label htmlFor="mail-body" className="text-[0.82rem] font-semibold">Message</label><textarea id="mail-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={CUSTOM_LIMITS.body} rows={7} placeholder="The Thursday tutorial is moved to Friday 27 Nov at 15:00 in A2-104." className={`${field} resize-y py-2.5 leading-relaxed`} /></div>
        <div className="flex flex-wrap items-center gap-3">
          <PButton type="submit" disabled={!body.trim()}><Send size={15} /> Send to inbox</PButton>
          <PButton type="button" variant="light" onClick={onClose}>Cancel</PButton>
          <span className="text-[0.8rem] text-[var(--p-warn)]" role="status">{note}</span>
        </div>
      </form>
    </PModal>
  );
}
