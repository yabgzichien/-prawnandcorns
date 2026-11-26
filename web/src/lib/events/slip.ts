import { buildPdf, type Op } from "../finance/pdf.ts";
import { ITEM_BY_ID, ITEM_OFFICE_RULES, VENUE_BY_ID } from "./catalogue.ts";
import { dateLabel } from "./checks.ts";
import { eventStatusOf, lineDecision, lineStatusOf } from "./decisions.ts";
import { ARRANGEMENT_LABEL, OFFICE_LABEL, waitingFor, type Decisions, type EventApplication } from "./types.ts";

/**
 * A booking slip as a PDF, laid out like the slips offices return: the application, the people, then one table each
 * for rooms, items and arrangements with a status and remark on every line. It is made on this device and says on
 * every page that it is a fictional demo document. Standard fonts only, so text is plain ASCII.
 */

const W = 595;
const H = 842;
const LEFT = 40;
const RIGHT = W - 40;
const FOOT = 78;

const wrap = (text: string, widthPt: number, size: number): string[] => {
  const max = Math.max(6, Math.floor(widthPt / (size * 0.52)));
  const out: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (!word) continue;
    if ((line + " " + word).trim().length > max) {
      if (line) out.push(line);
      line = word.length > max ? word.slice(0, max) : word;
    } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out.length ? out : [""];
};

class Pages {
  pages: Op[][] = [];
  ops: Op[] = [];
  y = 0;
  heading: string;
  constructor(heading: string) { this.heading = heading; this.next(); }
  next() {
    if (this.ops.length || this.pages.length) this.pages.push(this.ops);
    this.ops = [
      { t: "rect", x: 0, y: H - 70, w: W, h: 70, gray: 0.9 },
      { t: "text", x: LEFT, y: H - 44, size: 20, bold: true, s: this.heading },
      { t: "text", x: RIGHT, y: H - 44, size: 10, s: "DEMO DOCUMENT", right: true },
      { t: "line", x1: LEFT, y1: 62, x2: RIGHT, y2: 62 },
      { t: "text", x: LEFT, y: 46, size: 8.5, s: "Fictional demo document created by XMUM Compass. It was not issued by any university and has no legal value." },
      { t: "text", x: LEFT, y: 34, size: 8.5, s: "All names, numbers and decisions are invented. Nothing was sent to a real office." },
    ];
    this.y = H - 100;
  }
  ensure(h: number) { if (this.y - h < FOOT) this.next(); }
  finish() { this.pages.push(this.ops); return this.pages; }
}

export function bookingSlipPdf(app: EventApplication, decisions: Decisions): Uint8Array {
  const p = new Pages("BOOKING SLIP");
  const status = eventStatusOf(app, decisions);
  const when = `${dateLabel(app.date)} 2026, ${app.start} to ${app.end}`;

  const h2 = (s: string) => { p.ensure(40); p.y -= 14; p.ops.push({ t: "text", x: LEFT, y: p.y, size: 12, bold: true, s }, { t: "line", x1: LEFT, y1: p.y - 5, x2: RIGHT, y2: p.y - 5 }); p.y -= 22; };
  const row = (label: string, value: string) => {
    const lines = wrap(value, RIGHT - 190, 10);
    p.ensure(lines.length * 13 + 4);
    p.ops.push({ t: "text", x: LEFT, y: p.y, size: 10, bold: true, s: label });
    lines.forEach((l, i) => p.ops.push({ t: "text", x: 180, y: p.y - i * 13, size: 10, s: l }));
    p.y -= lines.length * 13 + 3;
  };

  p.ops.push({ t: "text", x: LEFT, y: p.y, size: 11, bold: true, s: `Application ${app.id}` }, { t: "text", x: RIGHT, y: p.y, size: 11, bold: true, s: status.toUpperCase(), right: true });
  p.y -= 8;
  h2("Applicant");
  row("Name", `${app.applicant.name} (${app.applicant.id})`);
  row("Adviser", `${app.adviser.name}, ${app.adviser.email}`);
  h2("Event");
  row("Event name", app.name);
  row("Organiser", app.organisers);
  row("Participants", String(app.participants));
  row("Date and time", when);
  if (app.description) row("Description", app.description);
  row("Submitted", `${app.submittedAt.slice(0, 10)}, saved in this browser`);
  const eventRemark = decisions[app.id]?.eventRemark;
  if (eventRemark) row("Remark", eventRemark);

  type Cell = { x: number; w: number; text: string; bold?: boolean };
  const table = (title: string, heads: Cell[], rows: Cell[][]) => {
    h2(title);
    if (rows.length === 0) { p.ops.push({ t: "text", x: LEFT, y: p.y, size: 9.5, s: "None requested." }); p.y -= 16; return; }
    const head = () => {
      p.ops.push({ t: "rect", x: LEFT, y: p.y - 5, w: RIGHT - LEFT, h: 17, gray: 0.88 });
      for (const c of heads) p.ops.push({ t: "text", x: c.x, y: p.y, size: 8, bold: true, s: c.text });
      p.y -= 18;
    };
    p.ensure(60);
    head();
    for (const cells of rows) {
      const wrapped = cells.map((c) => wrap(c.text, c.w, 8));
      const lines = Math.max(...wrapped.map((w) => w.length));
      if (p.y - lines * 10 < FOOT) { p.next(); head(); }
      cells.forEach((c, i) => wrapped[i].forEach((l, j) => p.ops.push({ t: "text", x: c.x, y: p.y - j * 10, size: 8, bold: c.bold, s: l })));
      // rule under the row, then room for the next row's first line so the rule never crosses text
      const bottom = p.y - (lines - 1) * 10 - 5;
      p.ops.push({ t: "line", x1: LEFT, y1: bottom, x2: RIGHT, y2: bottom, w: 0.3 });
      p.y = bottom - 12;
    }
    p.y -= 4;
  };

  const venues = app.lines.filter((l) => l.kind === "venue");
  table("Venues", [
    { x: 44, w: 110, text: "ROOM" }, { x: 160, w: 70, text: "DATE" }, { x: 232, w: 80, text: "TIME" }, { x: 316, w: 66, text: "STATUS" }, { x: 386, w: 166, text: "REMARKS" },
  ], venues.map((l) => {
    if (l.kind !== "venue") return [];
    const d = lineDecision(decisions, app.id, l.id);
    const given = d?.assignedVenueId && d.assignedVenueId !== l.venueId ? ` (you asked for ${l.venueId}, you were given ${d.assignedVenueId})` : "";
    const name = VENUE_BY_ID[d?.assignedVenueId ?? l.venueId]?.name ?? l.venueId;
    return [{ x: 44, w: 110, text: name + given, bold: true }, { x: 160, w: 70, text: dateLabel(l.date) }, { x: 232, w: 80, text: `${l.start} to ${l.end}` }, { x: 316, w: 66, text: lineStatusOf(decisions, app.id, l.id) }, { x: 386, w: 166, text: d?.remark ?? (d ? "" : waitingFor("venues")) }];
  }));

  const items = app.lines.filter((l) => l.kind === "item");
  table("Items", [
    { x: 44, w: 108, text: "ITEM" }, { x: 154, w: 28, text: "QTY" }, { x: 186, w: 124, text: "COLLECT AND RETURN" }, { x: 314, w: 66, text: "STATUS" }, { x: 384, w: 168, text: "REMARKS" },
  ], items.map((l) => {
    if (l.kind !== "item") return [];
    const item = ITEM_BY_ID[l.itemId];
    const rule = ITEM_OFFICE_RULES[item.office];
    const d = lineDecision(decisions, app.id, l.id);
    const qty = d?.approvedQty && d.approvedQty !== l.qty ? `${d.approvedQty} of ${l.qty}` : String(l.qty);
    const wait = d ? "" : waitingFor(item.office);
    return [
      { x: 44, w: 108, text: `${item.name} (${OFFICE_LABEL[item.office]})`, bold: true }, { x: 154, w: 28, text: qty },
      { x: 186, w: 124, text: `${dateLabel(l.collectDate)} to ${dateLabel(l.returnDate)}, collect ${rule.collect.start}-${rule.collect.end}, return ${rule.return.start}-${rule.return.end}, at ${rule.place}` },
      { x: 314, w: 66, text: lineStatusOf(decisions, app.id, l.id) }, { x: 384, w: 168, text: d?.remark ?? wait },
    ];
  }));

  const care = app.lines.filter((l) => l.kind === "care");
  table("Operation and Maintenance", [
    { x: 44, w: 110, text: "ARRANGEMENT" }, { x: 158, w: 150, text: "DESCRIPTION" }, { x: 312, w: 70, text: "DATE AND TIME" }, { x: 386, w: 62, text: "STATUS" }, { x: 452, w: 100, text: "REMARKS" },
  ], care.map((l) => {
    if (l.kind !== "care") return [];
    const d = lineDecision(decisions, app.id, l.id);
    return [{ x: 44, w: 110, text: ARRANGEMENT_LABEL[l.arrangement], bold: true }, { x: 158, w: 150, text: l.description }, { x: 312, w: 70, text: `${dateLabel(l.date)} ${l.start}-${l.end}` }, { x: 386, w: 62, text: lineStatusOf(decisions, app.id, l.id) }, { x: 452, w: 100, text: d?.remark ?? (d ? "" : waitingFor("operations")) }];
  }));

  return buildPdf(p.finish(), `Booking slip ${app.id}`);
}
