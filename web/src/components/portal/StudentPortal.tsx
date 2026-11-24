"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Download, FileText, Printer } from "lucide-react";
import { STUDENT } from "@/lib/data/academics";
import { downloadBytes } from "@/lib/finance/download";
import { KIND_LABEL, fileNameFor, outstanding, totals } from "@/lib/finance/ledger";
import { documentPdf, statementPdf } from "@/lib/finance/pdf";
import { useLedger } from "@/lib/finance/useLedger";
import { Badge, PButton, PCard, PageTitle } from "./ui";

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10).split("-").reverse().join("-");
const crumbs = (last: string) => ["Student Portal", last];
const docHref = (id: string) => `/demo/student-portal/documents/${id}`;

function LoggedIn() {
  return <p className="mb-5 text-[0.88rem] text-[var(--p-muted)]">You are logged in as <strong className="text-[var(--p-ink)]">{STUDENT.name} (demo)</strong></p>;
}

function Problem({ error }: { error: string }) {
  return error ? <p className="mb-4 flex gap-2 rounded-lg bg-[var(--p-warn-soft)] px-3 py-2 text-[0.84rem] text-[var(--p-warn)]" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</p> : null;
}

/** The student portal's front page: what is owed, what is coming, and what the university announced. */
export function StudentDashboard() {
  const { entries, outstanding: owed, error, ready } = useLedger();
  const unpaid = entries.filter((e) => e.kind === "invoice" && e.status === "Unpaid");
  return (
    <>
      <PageTitle title="Dashboard" crumbs={crumbs("Dashboard")} />
      <LoggedIn />
      <Problem error={error} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        <PCard title="Alerts" bodyClass="p-5">
          {!ready ? <p className="text-[0.88rem] text-[var(--p-muted)]" role="status">Loading.</p> : (
            <p className="text-[0.92rem]">You have outstanding balance of <strong className={owed > 0 ? "text-[var(--p-danger)]" : ""}>RM{money(owed)}</strong>{owed > 0 && <>. <Link href="/demo/student-portal/account-status" className="font-semibold text-[var(--p-primary)] underline-offset-2 hover:underline">See account status</Link></>}</p>
          )}
        </PCard>
        <PCard title="Reminder" bodyClass="p-5">
          {unpaid.length === 0 ? <p className="text-[0.88rem] text-[var(--p-muted)]">No Record Found</p> : (
            <ul className="space-y-2 text-[0.88rem]">{unpaid.map((e) => <li key={e.id}><span className="font-semibold">{e.description}</span> is due {e.dueDate ? day(e.dueDate) : "soon"}. <Link href={docHref(e.id)} className="font-semibold text-[var(--p-primary)] hover:underline">Open invoice</Link></li>)}</ul>
          )}
        </PCard>
        <PCard title="Announcement" bodyClass="p-5"><p className="text-[0.88rem] text-[var(--p-muted)]">No Record Found</p></PCard>
      </div>
    </>
  );
}

/** The ledger: one line per document with a running balance, like the real portal's Account Status page. */
export function AccountStatus() {
  const { entries, error, ready } = useLedger();
  const t = totals(entries);
  return (
    <>
      <PageTitle title="Account Status" crumbs={crumbs("Account Status")}>
        <PButton small onClick={() => downloadBytes("account-statement.pdf", statementPdf(entries))} disabled={!ready || entries.length === 0}><Download size={14} /> Download statement (PDF)</PButton>
      </PageTitle>
      <LoggedIn />
      <Problem error={error} />
      <PCard bodyClass="p-0">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[0.84rem]">
            <thead className="bg-[#f5f8fa] text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">
              <tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Doc No</th><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5 text-right">Debit (RM)</th><th className="px-3 py-2.5 text-right">Credit (RM)</th><th className="px-3 py-2.5 text-right">Balance (RM)</th><th className="px-3 py-2.5"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {!ready && <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--p-muted)]" role="status">Loading the statement.</td></tr>}
              {entries.map((e) => (
                <tr key={e.id} id={e.id} className="border-t border-[var(--p-line)]">
                  <td className="whitespace-nowrap px-3 py-2.5">{day(e.date)}</td>
                  <td className="px-3 py-2.5"><Link href={docHref(e.id)} className="font-semibold text-[var(--p-primary)] hover:underline">{e.id}</Link></td>
                  <td className="px-3 py-2.5">{e.description}{e.kind === "invoice" && e.status === "Unpaid" && <Badge tone="orange" className="ml-2">Unpaid</Badge>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{e.debit ? money(e.debit) : ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{e.credit ? money(e.credit) : ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(e.balance)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right"><button type="button" onClick={() => downloadBytes(fileNameFor(e), documentPdf(e, entries.find((x) => x.id === e.relatedDoc)))} aria-label={`Download ${KIND_LABEL[e.kind].toLowerCase()} ${e.id} as PDF`} className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-[0.78rem] font-semibold text-[var(--p-primary)] hover:bg-[var(--p-primary-soft)]"><Download size={13} /> PDF</button></td>
                </tr>
              ))}
              {ready && entries.length > 0 && <tr className="border-t border-[var(--p-line)] bg-[#f5f8fa] font-semibold"><td className="px-3 py-2.5" colSpan={3}>Total</td><td className="px-3 py-2.5 text-right tabular-nums">{money(t.debit)}</td><td className="px-3 py-2.5 text-right tabular-nums">{money(t.credit)}</td><td className="px-3 py-2.5 text-right tabular-nums">{money(outstanding(entries))}</td><td /></tr>}
            </tbody>
          </table>
        </div>
      </PCard>
      <p className="mt-3 text-[0.8rem] text-[var(--p-muted)]">Fictional demo data. Invoices add to the balance and payments reduce it. Document numbers start with DEMO.</p>
    </>
  );
}

/** One invoice or receipt, printable, with a PDF download. */
export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { entries, error, ready } = useLedger();
  const doc = entries.find((e) => e.id === id);
  const other = doc?.relatedDoc ? entries.find((e) => e.id === doc.relatedDoc) : undefined;
  return (
    <>
      <PageTitle title={doc ? `${KIND_LABEL[doc.kind]} ${doc.id}` : "Document"} crumbs={["Student Portal", "Account Status", doc?.id ?? "Document"]}>
        {doc && <div className="flex gap-2"><PButton small variant="light" onClick={() => window.print()}><Printer size={14} /> Print</PButton><PButton small onClick={() => downloadBytes(fileNameFor(doc), documentPdf(doc, other))}><Download size={14} /> Download PDF</PButton></div>}
      </PageTitle>
      <style>{`@media print { body * { visibility: hidden; } #doc-print, #doc-print * { visibility: visible; } #doc-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; } }`}</style>
      <Problem error={error} />
      {!ready ? <p className="text-[0.9rem] text-[var(--p-muted)]" role="status">Loading.</p> : !doc ? (
        <PCard bodyClass="p-6"><p className="font-semibold">No such document</p><p className="mt-1 text-[0.88rem] text-[var(--p-muted)]">It may not have been issued yet in this scenario. <Link href="/demo/student-portal/account-status" className="font-semibold text-[var(--p-primary)] hover:underline">Back to Account Status</Link></p></PCard>
      ) : (
        <article id="doc-print" className="max-w-[640px] rounded-xl border border-[var(--p-line)] bg-white p-7 shadow-[0_1px_3px_rgba(24,28,50,0.04)]">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--p-muted)]">Demo document, not issued by any university</p>
          <h2 className="mt-1 text-[1.3rem] font-bold tracking-[-0.02em]">{KIND_LABEL[doc.kind]} {doc.id}</h2>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[0.88rem]">
            <dt className="font-semibold">Date</dt><dd>{day(doc.date)}</dd>
            <dt className="font-semibold">Student</dt><dd>{STUDENT.name} ({STUDENT.id})</dd>
            <dt className="font-semibold">Programme</dt><dd>{STUDENT.programme}</dd>
            {doc.dueDate && doc.kind === "invoice" && <><dt className="font-semibold">Due date</dt><dd>{day(doc.dueDate)}</dd></>}
            {doc.method && <><dt className="font-semibold">Paid by</dt><dd>{doc.method}</dd></>}
            {other && <><dt className="font-semibold">{doc.kind === "invoice" ? "Paid by receipt" : "Payment for invoice"}</dt><dd><Link href={docHref(other.id)} className="font-semibold text-[var(--p-primary)] hover:underline">{other.id}</Link></dd></>}
          </dl>
          <table className="mt-5 w-full border-collapse text-[0.88rem]"><thead><tr className="border-b border-[var(--p-line)] text-left text-[0.74rem] uppercase tracking-[0.05em] text-[var(--p-muted)]"><th className="py-2">Description</th><th className="py-2 text-right">Amount (RM)</th></tr></thead>
            <tbody><tr><td className="py-3">{doc.description}</td><td className="py-3 text-right tabular-nums">{money(doc.kind === "invoice" ? doc.debit : doc.credit)}</td></tr></tbody>
            <tfoot><tr className="border-t border-[var(--p-line)] font-bold"><td className="py-3">{doc.kind === "invoice" ? "Total due" : "Total paid"}</td><td className="py-3 text-right tabular-nums">{money(doc.kind === "invoice" ? doc.debit : doc.credit)}</td></tr></tfoot>
          </table>
          {doc.kind === "invoice" && <p className="mt-3"><Badge tone={doc.status === "Paid" ? "green" : "orange"}>{doc.status ?? "Unpaid"}</Badge></p>}
        </article>
      )}
    </>
  );
}

/** Every document as a file you can download, like the real portal's Download File page. */
export function DownloadFiles() {
  const { entries, error, ready } = useLedger();
  const byNewest = [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id));
  return (
    <>
      <PageTitle title="Download File" crumbs={crumbs("Download File")} />
      <LoggedIn />
      <Problem error={error} />
      <PCard title="Invoices, receipts and statement" subtitle="Each file is a PDF made from the fictional account statement." bodyClass="p-0">
        <ul className="divide-y divide-[var(--p-line)]">
          <li className="flex flex-wrap items-center gap-3 px-5 py-3.5"><FileText size={18} className="text-[var(--p-muted)]" /><span className="min-w-0 flex-1 text-[0.9rem] font-semibold">Account statement</span><PButton small variant="light" disabled={!ready || entries.length === 0} onClick={() => downloadBytes("account-statement.pdf", statementPdf(entries))}><Download size={13} /> Download</PButton></li>
          {byNewest.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <FileText size={18} className="text-[var(--p-muted)]" />
              <span className="min-w-0 flex-1"><span className="block text-[0.9rem] font-semibold">{KIND_LABEL[e.kind]} {e.id}</span><span className="block text-[0.78rem] text-[var(--p-muted)]">{day(e.date)}, {e.description}</span></span>
              <PButton small variant="light" onClick={() => downloadBytes(fileNameFor(e), documentPdf(e, entries.find((x) => x.id === e.relatedDoc)))} aria-label={`Download ${KIND_LABEL[e.kind].toLowerCase()} ${e.id}`}><Download size={13} /> Download</PButton>
            </li>
          ))}
          {ready && entries.length === 0 && <li className="px-5 py-6 text-[0.88rem] text-[var(--p-muted)]">No files yet.</li>}
        </ul>
      </PCard>
    </>
  );
}
