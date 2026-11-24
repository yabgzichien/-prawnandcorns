"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { CUSTOM_LIMITS, addCustomNotice } from "@/lib/world/storage";
import { PButton, PCard, PageTitle } from "./ui";
import { useCustomEmails } from "./useScenario";

const field = "min-h-[40px] w-full rounded-lg border border-[var(--p-line)] bg-white px-3 text-[0.9rem] outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]";

export function MailPage() {
  const sent = useCustomEmails();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addCustomNotice({ from, subject, body });
    setNote(added ? "Added to the mock inbox. Compass will treat it as an untrusted email." : "Write some text first, and check that site storage is enabled.");
    if (added) { setBody(""); setSubject(""); }
  };

  return (
    <>
      <PageTitle title="Campus Email" crumbs={["Mailbox", "Write your own email"]} />
      <p className="mb-5 max-w-3xl text-[0.92rem] leading-relaxed text-[var(--p-muted)]">Good for a judge&rsquo;s question such as &quot;what if the lecturer writes this?&quot;. The text stays in this browser only. Compass reads it like any outside email, as untrusted content, so the university email system must be connected in Compass.</p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PCard title="New message" bodyClass="p-5">
          <form onSubmit={send} className="grid gap-4">
            <label className="grid gap-1.5 text-[0.82rem] font-semibold">From
              <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={CUSTOM_LIMITS.from} placeholder="Dr. Lim (demo)" className={field} />
            </label>
            <label className="grid gap-1.5 text-[0.82rem] font-semibold">Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={CUSTOM_LIMITS.subject} placeholder="Tutorial moved" className={field} />
            </label>
            <label className="grid gap-1.5 text-[0.82rem] font-semibold">Message
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={CUSTOM_LIMITS.body} rows={7} placeholder="The Thursday tutorial is moved to Friday 27 Nov at 15:00 in A2-104." className={`${field} resize-y py-2.5 leading-relaxed`} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <PButton type="submit" disabled={!body.trim()}><Send size={15} /> Add to inbox</PButton>
              <span className="text-[0.82rem] text-[var(--p-muted)]" role="status">{note || `${sent.length} custom email${sent.length === 1 ? "" : "s"} in this browser`}</span>
            </div>
          </form>
        </PCard>
        <PCard title="Added in this browser" bodyClass="p-0">
          {sent.length === 0 ? <p className="p-4 text-[0.85rem] text-[var(--p-muted)]">No custom emails yet.</p> : (
            <ul className="divide-y divide-[var(--p-line)]">{sent.map((m) => <li key={m.id} className="p-4"><p className="truncate text-[0.88rem] font-semibold">{m.subject}</p><p className="truncate text-[0.78rem] text-[var(--p-muted)]">{m.from}</p></li>)}</ul>
          )}
        </PCard>
      </div>
    </>
  );
}
