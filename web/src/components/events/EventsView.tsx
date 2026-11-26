"use client";

import { CalendarRange, Download, FilePlus2, MessageSquare, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/kit";
import { emptyDraft } from "@/lib/events/application";
import { EVENT_EXAMPLE } from "@/lib/events/request";
import { collectPlace } from "@/lib/events/catalogue";
import { dateLabel } from "@/lib/events/checks";
import { AUTO_SWAP, eventStatusOf, lineDecision, pendingCount } from "@/lib/events/decisions";
import { bookingSlipPdf } from "@/lib/events/slip";
import { OFFICE_LABEL, lineOffice, waitingFor, type Decisions, type EventApplication, type EventLine } from "@/lib/events/types";
import { itemOffice } from "@/lib/events/catalogue";
import { downloadBytes } from "@/lib/finance/download";
import { useApp } from "@/lib/state";
import { StatusPill, lineTitle, lineWhen } from "./shared";
import { useDecisions, useEventAlerts } from "./useEventData";


/**
 * Club event applications from the student's side: start one, and follow every room, item and arrangement with the
 * office's answer, remark and any room swap. Saved in this browser only; nothing here is sent to a real office.
 */
export function EventsView() {
  const { eventApplications, openEventApplication, openAgent, withdrawEventApplication } = useApp();
  const decisions = useDecisions();
  const { alerts, markSeen } = useEventAlerts(eventApplications);
  // the student is looking at the page, so the banner has nothing more to tell them
  useEffect(() => { if (alerts.length > 0) markSeen(); }, [alerts, markSeen]);
  const [error, setError] = useState("");

  return (
    <div>
      <PageHeader eyebrow="Club events" title="Rooms and items for your event" sub="Ask for every room and item in one application. Each office answers its own lines, so you see one page instead of a pile of emails. This demo sends nothing to a real office." />

      <section className="card mb-6 p-5" aria-label="Start an application">
        <h2 className="t-headline mb-1 flex items-center gap-2"><CalendarRange size={18} className="text-accent" /> Start an application</h2>
        <p className="t-sub mb-3">Tell Compass what the event needs in your own words, then check each step. Or fill in the form yourself.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openAgent(EVENT_EXAMPLE)} className="press btn btn-primary"><MessageSquare size={16} /> Describe it to Compass</button>
          <button type="button" onClick={() => openEventApplication(emptyDraft())} className="press btn btn-tint"><FilePlus2 size={16} /> Fill in the form</button>
        </div>
        <p className="t-caption mt-3">Example: &ldquo;{EVENT_EXAMPLE}&rdquo;</p>
      </section>

      <section aria-label="My applications">
        <h2 className="t-headline mb-3 px-1">My applications</h2>
        {error && <p className="mb-3 rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert">{error}</p>}
        {eventApplications.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-sep px-6 py-10 text-center"><p className="t-headline">No applications yet</p><p className="t-sub mt-1 max-w-sm">When you submit one it appears here, and the ECA office&rsquo;s answers show up next to each line.</p></div>
        ) : (
          <ul className="space-y-4">
            {[...eventApplications].reverse().map((app) => (
              <ApplicationCard key={app.id} app={app} decisions={decisions} onWithdraw={() => { const r = withdrawEventApplication(app.id); setError(r.ok ? "" : r.error); }} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Lines({ app, lines, decisions, title }: { app: EventApplication; lines: EventLine[]; decisions: Decisions; title: string }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <h4 className="t-eyebrow mb-1.5">{title}</h4>
      <ul className="divide-y divide-sep rounded-xl bg-surface-2">
        {lines.map((l) => {
          const d = lineDecision(decisions, app.id, l.id);
          const owner = OFFICE_LABEL[lineOffice(l, itemOffice)];
          const swapped = l.kind === "venue" && d?.assignedVenueId && d.assignedVenueId !== l.venueId;
          return (
            <li key={l.id} className="grid gap-1 px-3.5 py-3">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 break-words text-[0.95rem] font-semibold">{swapped ? `${d!.assignedVenueId}` : lineTitle(l)}</span>
                <StatusPill status={d?.status ?? "Pending"} />
              </div>
              <p className="t-caption">{lineWhen(l)}. {owner}.</p>
              {swapped && l.kind === "venue" && <p className="rounded-lg bg-orange-soft px-2.5 py-1.5 text-[0.84rem] font-medium text-orange">You asked for {l.venueId}. You were given {d!.assignedVenueId}.</p>}
              {l.kind === "item" && d?.approvedQty && d.approvedQty !== l.qty && <p className="rounded-lg bg-orange-soft px-2.5 py-1.5 text-[0.84rem] font-medium text-orange">{d.approvedQty} of the {l.qty} you asked for were approved.</p>}
              {l.kind === "item" && d && d.status !== "Rejected" && !d.remark?.includes(collectPlace(l.itemId)) && <p className="t-caption">Collect from {collectPlace(l.itemId)}.</p>}
              {d?.remark && !AUTO_SWAP.test(d.remark) && <p className="text-[0.88rem] leading-snug"><span className="font-semibold">{owner}:</span> {d.remark}</p>}
              {!d && <p className="t-caption">{waitingFor(lineOffice(l, itemOffice))}.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ApplicationCard({ app, decisions, onWithdraw }: { app: EventApplication; decisions: Decisions; onWithdraw: () => void }) {
  const status = eventStatusOf(app, decisions);
  const left = pendingCount(app, decisions);
  const decision = decisions[app.id];
  const answered = app.lines.length - left;
  return (
    <li className="card overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="tnum text-[0.85rem] font-bold text-label-2">{app.id}</span>
          <StatusPill status={status} />
        </div>
        <h3 className="mt-1 break-words text-[1.1rem] font-semibold tracking-[-0.01em]">{app.name}</h3>
        <p className="t-caption">{app.organisers}, {dateLabel(app.date)}, {app.start} to {app.end}, {app.participants} people</p>
        <p className="t-caption mt-1" role="status">{left === 0 ? "Every line has an answer." : `${answered} of ${app.lines.length} lines answered. ${left} still waiting.`}</p>
        <ol className="mt-2 flex gap-1" aria-label={`${answered} of ${app.lines.length} lines answered`}>{app.lines.map((l) => <li key={l.id} className="h-1.5 flex-1 rounded-full" style={{ background: lineDecision(decisions, app.id, l.id) ? "var(--accent)" : "var(--surface-3)" }} />)}</ol>
        {decision?.eventRemark && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[0.9rem]"><span className="font-semibold">ECA office:</span> {decision.eventRemark}</p>}
      </div>
      <div className="grid gap-3 px-4 pb-4">
        <Lines app={app} lines={app.lines.filter((l) => l.kind === "venue")} decisions={decisions} title="Rooms" />
        <Lines app={app} lines={app.lines.filter((l) => l.kind === "item")} decisions={decisions} title="Items" />
        <Lines app={app} lines={app.lines.filter((l) => l.kind === "care")} decisions={decisions} title="Operation and Maintenance" />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-sep p-3">
        <button type="button" onClick={() => downloadBytes(`booking-slip-${app.id}.pdf`, bookingSlipPdf(app, decisions))} className="press btn btn-sm btn-primary"><Download size={14} /> Download booking slip (PDF)</button>
        {answered === 0 && <button type="button" onClick={onWithdraw} className="press btn btn-sm btn-plain"><Undo2 size={14} /> Withdraw</button>}
      </div>
      <p className="t-caption border-t border-sep px-4 py-2.5">Saved in this browser. The slip is a fictional demo document made on this device.</p>
    </li>
  );
}

