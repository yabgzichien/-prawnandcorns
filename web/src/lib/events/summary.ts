import { ITEM_BY_ID, VENUE_BY_ID } from "./catalogue.ts";
import { dateLabel } from "./checks.ts";
import { ARRANGEMENT_LABEL, type EventLine } from "./types.ts";

/** One line of an application as plain text, for the model and for tests. */
export function lineWhenText(line: EventLine): string {
  if (line.kind === "venue") return `Room ${VENUE_BY_ID[line.venueId]?.name ?? line.venueId}, ${dateLabel(line.date)}, ${line.start} to ${line.end}`;
  if (line.kind === "item") return `${line.qty} x ${ITEM_BY_ID[line.itemId]?.name ?? line.itemId}, collect ${dateLabel(line.collectDate)}, return ${dateLabel(line.returnDate)}`;
  return `${ARRANGEMENT_LABEL[line.arrangement]}, ${dateLabel(line.date)}, ${line.start} to ${line.end}`;
}
