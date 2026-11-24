import type { LedgerEntry, LedgerKind } from "./ledger.ts";

/**
 * Understanding "find my tuition invoice" or "the receipt for my September payment", and picking the matching
 * documents from the account statement. Plain code, so the assistant never invents a document.
 */

export type DocumentRequest = {
  isRequest: boolean;
  /** Which kind the student named, or null for either. */
  kind: LedgerKind | null;
  /** Wants the whole account statement. */
  statement: boolean;
  topic: "tuition" | "hostel" | "registration" | null;
  instalment: 1 | 2 | null;
  latest: boolean;
  unpaid: boolean;
  /** 0 to 11 */
  month: number | null;
  summary: string;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseDocumentRequest(text: string): DocumentRequest {
  const t = text.toLowerCase();
  const asksForEmail = /\b(draft|write|compose)\b[^.?!]{0,40}\b(e-?mail|message|letter)\b/.test(t);
  const isRequest = !asksForEmail && /\b(invoice|invoices|receipt|receipts|e-?statement|statement of account|account statement|account status|fee slip|bill|proof of payment)\b/.test(t);
  const wantsReceipt = /\b(receipt|receipts|proof of payment)\b/.test(t);
  const wantsInvoice = /\b(invoice|invoices|bill|fee slip)\b/.test(t);
  const kind: LedgerKind | null = wantsReceipt && !wantsInvoice ? "receipt" : wantsInvoice && !wantsReceipt ? "invoice" : null;
  const statement = /\b(statement|account status)\b/.test(t);
  const topic = /\b(hostel|residence|rental|accommodation|dorm)\b/.test(t) ? "hostel" : /\bregistration\b/.test(t) ? "registration" : /\b(tuition|semester|instalment|installment|course fee)\b/.test(t) ? "tuition" : null;
  const instalment = /\b(instalment|installment)\s*(?:no\.?\s*)?(2|two)\b|\b(second|2nd)\b/.test(t) ? 2 : /\b(instalment|installment)\s*(?:no\.?\s*)?(1|one)\b|\b(first|1st)\b/.test(t) ? 1 : null;
  const latest = /\b(latest|newest|last|recent|current|new)\b/.test(t);
  const unpaid = /\b(unpaid|outstanding|overdue|owe|still due|not paid)\b/.test(t);
  const monthIndex = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b`).test(t));
  const month = monthIndex >= 0 ? monthIndex : null;
  const parts = [kind ?? "invoices and receipts", topic, instalment ? `instalment ${instalment}` : null, month !== null ? `from ${MONTHS[month]}` : null, unpaid ? "unpaid" : null, latest ? "latest" : null].filter(Boolean);
  return { isRequest, kind, statement, topic, instalment, latest, unpaid, month, summary: statement && !kind ? "your account statement" : parts.join(", ") };
}

export type DocumentMatch = { doc: LedgerEntry; other?: LedgerEntry };

const monthOf = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).getUTCMonth();

/** Matching documents, newest first. When nothing matches, the latest invoices are offered and `exact` is false. */
export function findDocuments(entries: readonly LedgerEntry[], request: Pick<DocumentRequest, "kind" | "topic" | "instalment" | "latest" | "unpaid" | "month">, limit = 4): { items: DocumentMatch[]; exact: boolean } {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pair = (e: LedgerEntry): DocumentMatch => ({ doc: e, ...(e.relatedDoc && byId.get(e.relatedDoc) ? { other: byId.get(e.relatedDoc) } : {}) });
  const newest = [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id));

  const matches = (e: LedgerEntry) => {
    if (request.kind && e.kind !== request.kind) return false;
    // a receipt carries the description of what it paid for, through its invoice
    const description = (e.kind === "receipt" && e.relatedDoc ? byId.get(e.relatedDoc)?.description ?? "" : e.description).toLowerCase();
    if (request.topic === "tuition" && !description.includes("tuition")) return false;
    if (request.topic === "hostel" && !/residence|rental|hostel/.test(description)) return false;
    if (request.topic === "registration" && !description.includes("registration")) return false;
    if (request.instalment && !description.includes(`instalment ${request.instalment}`)) return false;
    if (request.unpaid && !(e.kind === "invoice" && e.status === "Unpaid")) return false;
    if (request.month !== null && monthOf(e.date) !== request.month) return false;
    return true;
  };

  const hasFilter = request.topic || request.instalment || request.unpaid || request.month !== null;
  const found = newest.filter(matches);
  const picked = request.latest && !hasFilter ? found.slice(0, 1) : found;
  if (picked.length) return { items: picked.slice(0, limit).map(pair), exact: true };
  const fallback = newest.filter((e) => e.kind === (request.kind ?? "invoice")).slice(0, 3);
  return { items: fallback.map(pair), exact: false };
}
