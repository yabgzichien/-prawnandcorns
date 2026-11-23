"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Search, Shield, Wand2 } from "lucide-react";
import { DEPARTMENTS, type Department } from "@/lib/data/life";
import { composeEmail, extractNeed, mailtoHref, routeDepartment, type Tone } from "@/lib/email";
import { useApp } from "@/lib/state";
import { PageHeader, Segmented } from "@/components/ui/kit";

const EXAMPLES = ["I can't log in to Moodle", "I have a clash between two classes", "my hostel air-con is not working", "a receipt for my tuition payment"];

export function MailView() {
  const params = useSearchParams();
  const { showToast } = useApp();
  const initialDept = DEPARTMENTS.find((d) => d.id === params.get("dept"));
  const [need, setNeed] = useState(params.get("need") ?? "");
  const [deptId, setDeptId] = useState<string | null>(initialDept?.id ?? null);
  const [tone, setTone] = useState<Tone>("formal");
  const [override, setOverride] = useState<{ subject?: string; body?: string } | null>(null); // set once the student edits by hand
  const [dirQ, setDirQ] = useState("");
  const [copied, setCopied] = useState(false);

  const routed = useMemo(() => routeDepartment(need), [need]);
  const dept: Department | undefined = DEPARTMENTS.find((d) => d.id === (deptId ?? routed[0]?.dept.id));
  const clean = extractNeed(need);

  // the draft is derived from the inputs; hand edits sit on top until the inputs change or "Regenerate" is pressed
  const auto = dept && clean.trim() ? composeEmail(dept, clean, tone) : null;
  const edited = override !== null;
  const subject = override?.subject ?? auto?.subject ?? "";
  const body = override?.body ?? auto?.body ?? "";
  const setEdited = (v: boolean) => { if (!v) setOverride(null); };
  const draft = dept ? { to: dept, subject, body, tone } : null;
  const dir = DEPARTMENTS.filter((d) => (d.name + d.handles + d.email).toLowerCase().includes(dirQ.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Departmental emails" title="Mail assistant" sub="Say what you need in your own words. Compass picks the right office and writes the first draft." />

      <p className="mb-5 flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-[0.88rem] font-semibold text-green"><Shield size={17} /> Compass drafts, you send. Nothing leaves this page until you open it in your own mail app.</p>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-5">
          <section className="card min-w-0 p-5">
            <label htmlFor="need" className="t-headline mb-2 block">What do you need?</label>
            <textarea id="need" value={need} onChange={(e) => { setNeed(e.target.value); setEdited(false); }} rows={4} placeholder="e.g. I can't log in to Moodle since yesterday" className="w-full resize-none rounded-2xl bg-surface-2 p-4 text-[1rem] outline-none ring-1 ring-sep placeholder:text-label-3 focus:ring-2 focus:ring-accent" />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => <button key={e} onClick={() => { setNeed(e); setDeptId(null); setEdited(false); }} className="press btn btn-sm btn-plain">{e}</button>)}
            </div>
          </section>

          <section className="card min-w-0 p-5">
            <h2 className="t-headline mb-3">Send to</h2>
            {routed.length > 0 && !deptId && <p className="t-caption mb-3 flex items-center gap-1.5"><Wand2 size={14} className="text-accent" /> Suggested from what you wrote</p>}
            <div className="flex flex-wrap gap-2">
              {(routed.length ? routed.slice(0, 3).map((r) => r.dept) : DEPARTMENTS.slice(0, 3)).map((d) => (
                <button key={d.id} onClick={() => { setDeptId(d.id); setEdited(false); }} aria-pressed={dept?.id === d.id} className="press btn btn-sm" style={{ background: dept?.id === d.id ? "var(--accent)" : "var(--surface-3)", color: dept?.id === d.id ? "var(--accent-fg)" : "var(--label)" }}>{d.name}</button>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-full bg-surface-2 px-4 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
              <Search size={15} className="text-label-3" />
              <input value={dirQ} onChange={(e) => setDirQ(e.target.value)} placeholder="Browse all offices" aria-label="Search offices" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-label-3" />
            </label>
            <ul className="mt-2 max-h-[260px] divide-y divide-sep overflow-y-auto">
              {dir.map((d) => (
                <li key={d.id}>
                  <button onClick={() => { setDeptId(d.id); setEdited(false); }} className="press-row flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left">
                    <span className="min-w-0 flex-1"><span className="block text-[0.92rem] font-semibold tracking-[-0.01em]">{d.name}</span><span className="t-caption block truncate">{d.handles}</span></span>
                    {dept?.id === d.id && <Check size={17} className="text-accent" strokeWidth={3} />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card min-w-0 flex flex-col p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-headline">Draft</h2>
            <Segmented label="Tone" value={tone} onChange={(t) => { setTone(t); setEdited(false); }} options={[{ value: "formal", label: "Formal" }, { value: "brief", label: "Brief" }]} />
          </div>
          {!draft || !need.trim() ? (
            <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-sep px-6 py-16 text-center">
              <div><p className="t-headline">Your draft appears here</p><p className="t-sub mt-1">Describe what you need on the left.</p></div>
            </div>
          ) : (
            <>
              <p className="t-caption mb-3"><span className="font-semibold text-label">To:</span> {draft.to.name} &lt;{draft.to.email}&gt;</p>
              <label className="sr-only" htmlFor="subj">Subject</label>
              <input id="subj" value={subject} onChange={(e) => setOverride((o) => ({ subject: e.target.value, body: o?.body ?? body }))} className="mb-3 w-full rounded-xl bg-surface-2 px-4 py-3 text-[0.95rem] font-semibold outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent" />
              <label className="sr-only" htmlFor="body">Message</label>
              <textarea id="body" value={body} onChange={(e) => setOverride((o) => ({ subject: o?.subject ?? subject, body: e.target.value }))} rows={14} className="w-full flex-1 resize-y rounded-xl bg-surface-2 p-4 text-[0.93rem] leading-[1.55] outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent" />
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={mailtoHref(draft)} className="press btn btn-primary"><ExternalLink size={16} /> Open in mail app</a>
                <button onClick={async () => { try { await navigator.clipboard.writeText(`To: ${draft.to.email}\nSubject: ${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); showToast("Draft copied"); } catch { showToast("Couldn't copy — select the text instead"); } }} className="press btn btn-plain">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}</button>
                {edited && <button onClick={() => setEdited(false)} className="press btn btn-plain"><RefreshCw size={16} /> Regenerate</button>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
