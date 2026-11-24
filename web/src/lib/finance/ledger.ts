import type { World } from "../world/types.ts";

/**
 * The student's account statement, as a university student portal shows it: one line per document, with a running
 * balance. Invoices add to what is owed (debit). Payments and credit notes reduce it (credit). Everything here is
 * invented, and document numbers use a DEMO prefix so none can be mistaken for a real one.
 * The ledger is worked out from the demo world, so when Finance posts an instalment a new invoice appears.
 */

export type LedgerKind = "invoice" | "receipt";

export type LedgerEntry = {
  /** Document number, safe in a URL: DEMO-IV-200102 */
  id: string;
  kind: LedgerKind;
  date: string; // ISO
  description: string;
  debit: number;
  credit: number;
  /** Running balance after this line. Negative means the student is in credit. */
  balance: number;
  /** For an invoice: whether a payment has been recorded against it. */
  status?: "Paid" | "Unpaid";
  /** The invoice a receipt pays, or the receipt that paid an invoice. */
  relatedDoc?: string;
  dueDate?: string;
  /** How a receipt was paid. */
  method?: string;
};

type Draft = Omit<LedgerEntry, "balance">;

const REG_INVOICE = "DEMO-IV-200101";
const T1_INVOICE = "DEMO-IV-200102";

export function buildLedger(world: Pick<World, "fees">): LedgerEntry[] {
  const drafts: Draft[] = [
    { id: REG_INVOICE, kind: "invoice", date: "2026-08-20T00:00:00+08:00", description: "REGISTRATION FEE - (Initial)", debit: 300, credit: 0, status: "Paid", relatedDoc: "DEMO-OR-100231" },
    { id: "DEMO-OR-100231", kind: "receipt", date: "2026-08-28T00:00:00+08:00", description: "Payment", debit: 0, credit: 300, relatedDoc: REG_INVOICE, method: "Card" },
  ];
  const fees = new Map(world.fees.filter((f) => f.posted).map((f) => [f.id, f]));

  const f1 = fees.get("f1");
  if (f1) {
    drafts.push({ id: T1_INVOICE, kind: "invoice", date: "2026-08-20T00:00:00+08:00", description: "TUITION FEE - (Semester 1), instalment 1", debit: f1.amount, credit: 0, status: f1.status === "paid" ? "Paid" : "Unpaid", dueDate: f1.due, ...(f1.status === "paid" ? { relatedDoc: "DEMO-OR-100307" } : {}) });
    if (f1.status === "paid") drafts.push({ id: "DEMO-OR-100307", kind: "receipt", date: f1.paidOn ?? "2026-09-12T00:00:00+08:00", description: "E-Payment", debit: 0, credit: f1.amount, relatedDoc: T1_INVOICE, method: "Online banking" });
  }
  const f2 = fees.get("f2");
  if (f2) drafts.push({ id: "DEMO-IV-200188", kind: "invoice", date: "2026-11-23T00:00:00+08:00", description: "TUITION FEE - (Semester 1), instalment 2", debit: f2.amount, credit: 0, status: "Unpaid", dueDate: f2.due });
  const f3 = fees.get("f3");
  if (f3) drafts.push({ id: "DEMO-IV-200190", kind: "invoice", date: "2026-11-23T00:00:00+08:00", description: "RESIDENCE RENTAL - (Semester 1)", debit: f3.amount, credit: 0, status: "Unpaid", dueDate: f3.due });

  // oldest first, an invoice before the payment that settles it on the same day
  drafts.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "invoice" ? -1 : 1));
  let balance = 0;
  return drafts.map((d) => { balance = Math.round((balance + d.debit - d.credit) * 100) / 100; return { ...d, balance }; });
}

export const outstanding = (entries: readonly LedgerEntry[]): number => Math.max(0, entries.length ? entries[entries.length - 1].balance : 0);
export const totals = (entries: readonly LedgerEntry[]) => ({ debit: entries.reduce((s, e) => s + e.debit, 0), credit: entries.reduce((s, e) => s + e.credit, 0) });

export const KIND_LABEL: Record<LedgerKind, string> = { invoice: "Invoice", receipt: "Receipt" };
export const DOC_ID = /^DEMO-(IV|OR)-\d{6}$/;
export const fileNameFor = (entry: Pick<LedgerEntry, "id" | "kind">) => `${KIND_LABEL[entry.kind].toLowerCase()}-${entry.id}.pdf`;

/** Cleans a ledger received over the network or from a saved copy. Anything malformed is dropped. */
export function sanitizeLedger(raw: unknown): LedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LedgerEntry[] = [];
  const seen = new Set<string>();
  for (const e of raw.slice(0, 60)) {
    if (!e || typeof e !== "object") continue;
    const x = e as Partial<LedgerEntry>;
    if (typeof x.id !== "string" || !DOC_ID.test(x.id) || seen.has(x.id) || (x.kind !== "invoice" && x.kind !== "receipt")) continue;
    if (typeof x.date !== "string" || !Number.isFinite(Date.parse(x.date)) || typeof x.description !== "string" || x.description.length > 120) continue;
    if (![x.debit, x.credit, x.balance].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    seen.add(x.id);
    out.push({
      id: x.id, kind: x.kind, date: x.date, description: x.description, debit: x.debit!, credit: x.credit!, balance: x.balance!,
      ...(x.status === "Paid" || x.status === "Unpaid" ? { status: x.status } : {}),
      ...(typeof x.relatedDoc === "string" && DOC_ID.test(x.relatedDoc) ? { relatedDoc: x.relatedDoc } : {}),
      ...(typeof x.dueDate === "string" && Number.isFinite(Date.parse(x.dueDate)) ? { dueDate: x.dueDate } : {}),
      ...(typeof x.method === "string" && x.method.length <= 40 ? { method: x.method } : {}),
    });
  }
  return out;
}
