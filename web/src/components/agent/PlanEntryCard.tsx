"use client";

import { useState } from "react";
import { CalendarCheck, CheckCircle2, Pencil } from "lucide-react";
import type { AgentCard } from "@/lib/agent";
import { dateLabel } from "@/lib/events/checks";
import type { EntryDraft } from "@/lib/plans/entries";
import { useApp } from "@/lib/state";
import { EntryEditor } from "@/components/plans/EntryEditor";

type Card = Extract<AgentCard, { kind: "plan-entry" }>;

/** The assistant's reading of what the student said. They edit the fields and press Add; only then is it saved, in this browser. */
export function PlanEntryCard({ card }: { card: Card }) {
  const { saveEntry } = useApp();
  const [saved, setSaved] = useState<{ draft: EntryDraft } | null>(null);
  const [skipped, setSkipped] = useState(false);

  if (saved) {
    const d = saved.draft;
    return (
      <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-surface px-3.5 py-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green" aria-hidden />
        <p className="min-w-0 text-[0.92rem] [overflow-wrap:anywhere]">
          <span className="font-semibold">{d.kind === "todo" ? "Added to your to-do list" : "Added to your calendar"}:</span> {d.title.trim()}{d.date ? `, ${dateLabel(d.date)}${d.start ? ` ${d.start}` : ""}` : ""}. Saved in this browser. You can edit or remove it on Today, and the Undo in the message at the bottom takes it back.
        </p>
      </div>
    );
  }
  if (skipped) return <p className="t-caption rounded-2xl bg-surface px-3.5 py-3">Not added. Nothing was saved.</p>;

  return (
    <div className="overflow-hidden rounded-2xl bg-surface" aria-label={card.reading.kind === "todo" ? "New to-do" : "New calendar entry"}>
      <div className="flex items-center gap-2 border-b border-sep px-3.5 py-2.5">
        {card.reading.kind === "todo" ? <Pencil size={15} className="text-label-2" aria-hidden /> : <CalendarCheck size={15} className="text-label-2" aria-hidden />}
        <p className="t-caption font-semibold text-label">Check the details, then add. Not saved yet.</p>
      </div>
      <div className="px-3.5 py-3">
        <EntryEditor
          initial={card.reading.draft}
          mode="create"
          idPrefix="agent-entry"
          autoFocus={false}
          notes={card.reading.notes}
          onCancel={() => setSkipped(true)}
          onSave={(d) => {
            const r = saveEntry(d);
            if (!r.ok) return r;
            setSaved({ draft: d });
            return { ok: true };
          }}
        />
      </div>
    </div>
  );
}
