"use client";

import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import { downloadBytes } from "@/lib/finance/download";
import { KIND_LABEL, fileNameFor, type LedgerEntry } from "@/lib/finance/ledger";
import { documentPdf, statementPdf } from "@/lib/finance/pdf";
import type { DocumentMatch } from "@/lib/finance/search";
import { useApp } from "@/lib/state";
import { Pill } from "@/components/ui/kit";

const money = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10).split("-").reverse().join("-");

/**
 * Invoices and receipts the assistant found in the account statement. Each Download button makes a PDF on this device
 * when pressed. Nothing is emailed or uploaded, and the files are fictional demo documents.
 */
export function DocumentsCard({ card, onNavigate }: { card: { summary: string; items: DocumentMatch[]; exact: boolean; entries: LedgerEntry[] }; onNavigate: () => void }) {
  const { showToast } = useApp();
  const get = (e: LedgerEntry) => {
    downloadBytes(fileNameFor(e), documentPdf(e, card.entries.find((x) => x.id === e.relatedDoc)));
    showToast(`Downloaded ${KIND_LABEL[e.kind].toLowerCase()} ${e.id} (PDF, demo document).`);
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-surface" aria-label="Documents you can download">
      <div className="border-b border-sep px-3.5 py-3"><h3 className="text-[0.95rem] font-semibold">{card.items.length === 0 ? "Account statement" : card.exact ? "Matching documents" : "Closest documents"}</h3><p className="t-caption">Looked for: {card.summary}</p></div>
      <ul className="divide-y divide-sep">
        {card.items.map(({ doc, other }) => (
          <li key={doc.id} className="px-3.5 py-3">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <FileText size={18} className="mt-0.5 shrink-0 text-label-2" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-[0.95rem] font-semibold">{KIND_LABEL[doc.kind]} {doc.id}</p>
                <p className="t-caption break-words">{day(doc.date)}, {doc.description}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.84rem] font-semibold">{money(doc.kind === "invoice" ? doc.debit : doc.credit)}{doc.kind === "invoice" && <Pill tone={doc.status === "Paid" ? "green" : "orange"}>{doc.status ?? "Unpaid"}</Pill>}{doc.kind === "invoice" && doc.status === "Unpaid" && doc.dueDate && <span className="t-caption font-normal">due {day(doc.dueDate)}</span>}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2 pl-[30px]">
              <button type="button" onClick={() => get(doc)} className="press btn btn-sm btn-primary"><Download size={14} /> Download {KIND_LABEL[doc.kind].toLowerCase()}</button>
              {other && <button type="button" onClick={() => get(other)} className="press btn btn-sm btn-plain"><Download size={14} /> {KIND_LABEL[other.kind]} {other.id}</button>}
              <Link href={`/demo/student-portal/documents/${doc.id}`} target="_blank" onClick={onNavigate} className="press btn btn-sm btn-plain"><ExternalLink size={14} /> Open in portal</Link>
            </div>
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-2 px-3.5 py-3">
          <span className="min-w-0 flex-1 text-[0.88rem]">Everything on one page</span>
          <button type="button" onClick={() => { downloadBytes("account-statement.pdf", statementPdf(card.entries)); showToast("Downloaded account statement (PDF, demo document)."); }} className="press btn btn-sm btn-tint"><Download size={14} /> Account statement</button>
        </li>
      </ul>
      <p className="t-caption border-t border-sep px-3.5 py-2.5">Made on this device when you press Download. Fictional demo documents with no legal or financial value.</p>
    </section>
  );
}
