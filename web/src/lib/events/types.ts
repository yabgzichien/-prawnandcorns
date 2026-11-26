/**
 * Club event applications. One application describes one event and carries every line the club needs:
 * rooms, items and any arrangement from the Operation and Maintenance Office. Each line is answered on its own,
 * by the office that owns it. Everything here is invented demo data; nothing is sent to a real office.
 */

export type Office = "eca" | "pamo" | "it" | "venues" | "operations";
export const OFFICES: readonly Office[] = ["eca", "venues", "pamo", "it", "operations"];
export const OFFICE_LABEL: Record<Office, string> = {
  eca: "ECA office",
  venues: "Venue office",
  pamo: "PAMO",
  it: "IT office",
  operations: "Operation and Maintenance Office",
};

export type LineStatus = "Pending" | "Approved" | "Approve With Condition" | "Rejected";
export type Decided = Exclude<LineStatus, "Pending">;
export const DECIDED: readonly Decided[] = ["Approved", "Approve With Condition", "Rejected"];
export const LINE_STATUSES: readonly LineStatus[] = ["Pending", ...DECIDED];

export type ArrangementType = "furniture" | "power" | "aircon" | "cleaning" | "security";
export const ARRANGEMENT_LABEL: Record<ArrangementType, string> = {
  furniture: "Furniture arrangement",
  power: "Power and extension cords",
  aircon: "Air-conditioning and lighting",
  cleaning: "Extra cleaning",
  security: "Security and access",
};
export const ARRANGEMENTS = Object.keys(ARRANGEMENT_LABEL) as ArrangementType[];

/** A room for the event. The request keeps the room the club asked for, even if staff give another one. */
export type VenueLine = { kind: "venue"; id: string; venueId: string; date: string; start: string; end: string };
/** An item to borrow. The collect and return windows come from the office that owns the item. */
export type ItemLine = { kind: "item"; id: string; itemId: string; qty: number; collectDate: string; returnDate: string };
/** An arrangement the club asks the Operation and Maintenance Office for. Optional. */
export type CareLine = { kind: "care"; id: string; arrangement: ArrangementType; description: string; date: string; start: string; end: string };
export type EventLine = VenueLine | ItemLine | CareLine;

export type Adviser = { name: string; email: string };

export type EventDraft = {
  name: string;
  /** The clubs organising it, as one line of text, for example "Robotics & AI Society". */
  organisers: string;
  participants: number;
  /** One day events only. YYYY-MM-DD. */
  date: string;
  start: string;
  end: string;
  description: string;
  adviser: Adviser;
  lines: EventLine[];
};

export type EventApplication = EventDraft & {
  id: string;
  /** ISO 8601 with +08:00. */
  submittedAt: string;
  applicant: { name: string; id: string };
  /** True for applications from other clubs that the console shows so the queue looks like a real one. Never saved by Compass. */
  seeded?: boolean;
};

export type LineDecision = {
  status: Decided;
  remark?: string;
  /** The room staff give instead of the one asked for. */
  assignedVenueId?: string;
  /** Staff may approve fewer items than asked for. */
  approvedQty?: number;
  updatedAt: string;
};
export type EventDecision = { eventStatus: LineStatus; eventRemark?: string; sentAt: string; lines: Record<string, LineDecision> };
/** What the desk has said, by application id. Only the console window writes this. */
export type Decisions = Record<string, EventDecision>;

export const DECISIONS_KEY = "compass:eca-decisions:v1";
/** Which decisions the student has already been told about. Compass writes it. */
export const EVENTS_SEEN_KEY = "compass:eca-seen:v1";

export type IssueLevel = "problem" | "warning" | "info";
/** `missing` marks something only the student can supply, such as an adviser, so it reads as "Still needed" rather than a mistake. */
export type Issue = { id: string; level: IssueLevel; lineId?: string; message: string; missing?: boolean };

/** "Waiting for PAMO", "Waiting for the ECA office". */
export const waitingFor = (o: Office): string => `Waiting for ${o === "pamo" ? "PAMO" : `the ${OFFICE_LABEL[o]}`}`;

export const lineOffice = (line: EventLine, itemOffice: (itemId: string) => Office): Office =>
  line.kind === "venue" ? "venues" : line.kind === "care" ? "operations" : itemOffice(line.itemId);
