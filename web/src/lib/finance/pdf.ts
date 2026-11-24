import { STUDENT } from "../data/academics.ts";
import { KIND_LABEL, outstanding, totals, type LedgerEntry } from "./ledger.ts";

/**
 * A tiny PDF writer: one or more A4 pages of text and lines, standard fonts, no dependencies.
 * Enough for a demo invoice, receipt or statement, and it runs in the browser and in tests.
 * Text is limited to what the standard fonts hold; anything else becomes "?".
 */

type Op = { t: "text"; x: number; y: number; size: number; bold?: boolean; s: string; right?: boolean } | { t: "line"; x1: number; y1: number; x2: number; y2: number; w?: number } | { t: "rect"; x: number; y: number; w: number; h: number; gray: number };

const W = 595;
const H = 842;
const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
/** Helvetica advances, close enough to right-align numbers. */
const width = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.56 : 0.52);

function content(ops: Op[]): string {
  const out: string[] = [];
  for (const o of ops) {
    if (o.t === "rect") out.push(`${o.gray} g ${o.x} ${o.y} ${o.w} ${o.h} re f 0 g`);
    else if (o.t === "line") out.push(`${o.w ?? 0.6} w ${o.x1} ${o.y1} m ${o.x2} ${o.y2} l S`);
    else {
      const x = o.right ? o.x - width(o.s, o.size, o.bold) : o.x;
      out.push(`BT /${o.bold ? "F2" : "F1"} ${o.size} Tf ${x.toFixed(1)} ${o.y} Td (${esc(o.s)}) Tj ET`);
    }
  }
  return out.join("\n");
}

export function buildPdf(pages: Op[][], title: string): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add("");        // 1
  const pagesObj = add("");       // 2
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const info = add(`<< /Title (${esc(title)}) /Producer (XMUM Compass demo) >>`);
  const kids: number[] = [];
  for (const ops of pages) {
    const stream = content(ops);
    const c = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // every character is ASCII by construction, so characters equal bytes
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
}

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10).split("-").reverse().join("-");

function frame(heading: string, ops: Op[]): Op[] {
  return [
    { t: "rect", x: 0, y: H - 70, w: W, h: 70, gray: 0.12 },
    { t: "text", x: 40, y: H - 44, size: 20, bold: true, s: heading },
    { t: "text", x: W - 40, y: H - 44, size: 10, s: "DEMO DOCUMENT", right: true },
    ...ops,
    { t: "line", x1: 40, y1: 62, x2: W - 40, y2: 62 },
    { t: "text", x: 40, y: 46, size: 8.5, s: "Fictional demo document created by XMUM Compass. It was not issued by any university and has no legal or financial value." },
    { t: "text", x: 40, y: 34, size: 8.5, s: "All names, numbers and amounts are invented." },
  ];
}

/** An invoice or a receipt, as one page. */
export function documentPdf(entry: LedgerEntry, related?: LedgerEntry): Uint8Array {
  const isInvoice = entry.kind === "invoice";
  let y = H - 120;
  const row = (label: string, value: string) => { y -= 18; return [{ t: "text", x: 40, y, size: 10, s: label, bold: true } as Op, { t: "text", x: 170, y, size: 10, s: value } as Op]; };
  const ops: Op[] = [
    { t: "text", x: 40, y, size: 11, bold: true, s: `${KIND_LABEL[entry.kind].toUpperCase()} ${entry.id}` },
    ...row("Date", day(entry.date)),
    ...row("Student", `${STUDENT.name} (${STUDENT.id})`),
    ...row("Programme", STUDENT.programme),
    ...(isInvoice && entry.dueDate ? row("Due date", day(entry.dueDate)) : []),
    ...(!isInvoice && entry.method ? row("Paid by", entry.method) : []),
    ...(entry.relatedDoc ? row(isInvoice ? "Paid by receipt" : "Payment for invoice", entry.relatedDoc) : []),
  ];
  y -= 40;
  ops.push({ t: "rect", x: 40, y: y - 6, w: W - 80, h: 22, gray: 0.9 });
  ops.push({ t: "text", x: 48, y, size: 10, bold: true, s: "Description" }, { t: "text", x: W - 48, y, size: 10, bold: true, s: "Amount (RM)", right: true });
  y -= 28;
  const amount = isInvoice ? entry.debit : entry.credit;
  ops.push({ t: "text", x: 48, y, size: 10.5, s: entry.description }, { t: "text", x: W - 48, y, size: 10.5, s: money(amount), right: true });
  y -= 18;
  ops.push({ t: "line", x1: 40, y1: y, x2: W - 40, y2: y });
  y -= 24;
  ops.push({ t: "text", x: W - 150, y, size: 11, bold: true, s: isInvoice ? "Total due" : "Total paid" }, { t: "text", x: W - 48, y, size: 11, bold: true, s: money(amount), right: true });
  y -= 26;
  if (isInvoice) ops.push({ t: "text", x: 40, y, size: 10.5, bold: true, s: `Status: ${entry.status ?? "Unpaid"}${related ? ` (paid ${day(related.date)})` : ""}` });
  return buildPdf([frame(isInvoice ? "INVOICE" : "RECEIPT", ops)], `${KIND_LABEL[entry.kind]} ${entry.id}`);
}

/** The whole account statement, newest page last. Long ledgers continue onto more pages. */
export function statementPdf(entries: readonly LedgerEntry[]): Uint8Array {
  const perPage = 32;
  const chunks: LedgerEntry[][] = [];
  for (let i = 0; i < Math.max(entries.length, 1); i += perPage) chunks.push(entries.slice(i, i + perPage));
  const t = totals(entries);
  const pages = chunks.map((chunk, p) => {
    let y = H - 110;
    const ops: Op[] = [];
    if (p === 0) {
      ops.push({ t: "text", x: 40, y, size: 10, s: `${STUDENT.name} (${STUDENT.id}), ${STUDENT.programme}` });
      y -= 26;
    }
    ops.push({ t: "rect", x: 40, y: y - 6, w: W - 80, h: 20, gray: 0.9 });
    ops.push({ t: "text", x: 46, y, size: 8.5, bold: true, s: "Date" }, { t: "text", x: 100, y, size: 8.5, bold: true, s: "Doc No" }, { t: "text", x: 200, y, size: 8.5, bold: true, s: "Description" }, { t: "text", x: 410, y, size: 8.5, bold: true, s: "Debit", right: true }, { t: "text", x: 470, y, size: 8.5, bold: true, s: "Credit", right: true }, { t: "text", x: W - 44, y, size: 8.5, bold: true, s: "Balance (RM)", right: true });
    for (const e of chunk) {
      y -= 18;
      ops.push({ t: "text", x: 46, y, size: 8.5, s: day(e.date) }, { t: "text", x: 100, y, size: 8.5, s: e.id }, { t: "text", x: 200, y, size: 8.5, s: e.description.slice(0, 38) }, { t: "text", x: 410, y, size: 8.5, s: e.debit ? money(e.debit) : "", right: true }, { t: "text", x: 470, y, size: 8.5, s: e.credit ? money(e.credit) : "", right: true }, { t: "text", x: W - 44, y, size: 8.5, s: money(e.balance), right: true });
    }
    if (p === chunks.length - 1) {
      y -= 12;
      ops.push({ t: "line", x1: 40, y1: y, x2: W - 40, y2: y });
      y -= 18;
      ops.push({ t: "text", x: 200, y, size: 9, bold: true, s: "Total" }, { t: "text", x: 410, y, size: 9, bold: true, s: money(t.debit), right: true }, { t: "text", x: 470, y, size: 9, bold: true, s: money(t.credit), right: true });
      y -= 20;
      ops.push({ t: "text", x: 40, y, size: 10, bold: true, s: `Outstanding balance: RM ${money(outstanding(entries))}` });
    }
    return frame("ACCOUNT STATEMENT", ops);
  });
  return buildPdf(pages, "Account statement");
}
