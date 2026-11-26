import type { Office } from "./types.ts";

/**
 * What a club can ask for. Room codes and capacities follow the public room lists; stock, windows and limits
 * are invented for the demo. Capacities are approximate and the UI says so.
 */

export type Venue = { id: string; name: string; group: "Block A classrooms" | "Block B classrooms"; kind: string; capacity: number };

const flip = (id: string): Venue => ({ id, name: id, group: "Block A classrooms", kind: "Flip chair classroom", capacity: 60 });
const lecture = (id: string, capacity: number): Venue => ({ id, name: id, group: "Block B classrooms", kind: capacity >= 100 ? "Large classroom" : "Classroom", capacity });

export const VENUES: Venue[] = [
  ...["A4-G05", "A4-G06", "A4-G07", "A4-G08", "A4-G09", "A4-G10"].map(flip),
  lecture("B1-B06-2", 140),
  lecture("B1-B08", 120),
  lecture("B1-212", 50),
  lecture("B1-213", 50),
  lecture("B1-214", 50),
];
export const VENUE_BY_ID: Record<string, Venue> = Object.fromEntries(VENUES.map((v) => [v.id, v]));

export type OfficeWindow = { start: string; end: string };
export type ItemOffice = Extract<Office, "eca" | "pamo" | "it">;

/** When each office hands items out and takes them back, and where. The same for every item the office owns. */
export const ITEM_OFFICE_RULES: Record<ItemOffice, { collect: OfficeWindow; return: OfficeWindow; place: string; collectDayOffset: number }> = {
  eca: { collect: { start: "15:00", end: "16:00" }, return: { start: "15:00", end: "16:00" }, place: "ECA office (demo)", collectDayOffset: -1 },
  pamo: { collect: { start: "10:00", end: "11:00" }, return: { start: "15:00", end: "16:00" }, place: "LG-B12", collectDayOffset: 0 },
  it: { collect: { start: "15:00", end: "16:00" }, return: { start: "15:00", end: "16:00" }, place: "A3 Level 2 Circulation Counter", collectDayOffset: -1 },
};

export type CatalogueItem = {
  id: string;
  name: string;
  office: ItemOffice;
  /** How many the office owns, invented. */
  stock: number;
  /** The most one application may ask for. */
  maxPerRequest: number;
  /** Words a student might use, lower case, singular or plural. */
  aliases: string[];
};

export const ITEMS: CatalogueItem[] = [
  { id: "speaker", name: "Portable speaker with wireless mics", office: "eca", stock: 4, maxPerRequest: 4, aliases: ["portable speakers?", "speakers?", "sound systems?", "wireless mics?", "microphones?", "mics?", "pa systems?"] },
  { id: "prize-tray", name: "Prize tray", office: "eca", stock: 5, maxPerRequest: 5, aliases: ["prize trays?", "trophy trays?", "trays?"] },
  { id: "megaphone", name: "Megaphone", office: "eca", stock: 4, maxPerRequest: 4, aliases: ["megaphones?", "loudhailers?", "bullhorns?"] },
  { id: "stopwatch", name: "Stopwatch", office: "eca", stock: 20, maxPerRequest: 20, aliases: ["stop ?watch(?:es)?", "timers?"] },
  { id: "plastic-chair", name: "Plastic chair", office: "pamo", stock: 400, maxPerRequest: 200, aliases: ["plastic chairs?", "chairs?"] },
  { id: "banquet-table", name: "Plastic banquet table", office: "pamo", stock: 60, maxPerRequest: 40, aliases: ["plastic banquet tables?", "banquet tables?", "folding tables?", "tables?"] },
  { id: "signage-stand", name: "Signage stand", office: "pamo", stock: 60, maxPerRequest: 30, aliases: ["signage stands?", "sign stands?", "sign boards?", "signboards?", "standees?"] },
  { id: "signage-frame", name: "Signage frame (horizontal)", office: "pamo", stock: 40, maxPerRequest: 30, aliases: ["signage frames?", "sign frames?", "banner frames?"] },
  { id: "walkie-talkie", name: "Walkie talkie (max 10 units)", office: "pamo", stock: 12, maxPerRequest: 10, aliases: ["walkie[- ]?talkies?", "walkie[- ]?talkie", "two[- ]way radios?", "radios?"] },
  { id: "air-cooler", name: "Air cooler", office: "pamo", stock: 6, maxPerRequest: 4, aliases: ["air coolers?", "coolers?", "portable fans?", "industrial fans?"] },
  { id: "media-card", name: "Classroom multimedia access card", office: "it", stock: 8, maxPerRequest: 4, aliases: ["(?:classroom )?multimedia (?:access )?cards?", "access cards?", "projector cards?", "av cards?"] },
];
export const ITEM_BY_ID: Record<string, CatalogueItem> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const itemOffice = (itemId: string): Office => ITEM_BY_ID[itemId]?.office ?? "eca";

/** Where the club collects an item, in words. */
export const collectPlace = (itemId: string): string => ITEM_OFFICE_RULES[ITEM_BY_ID[itemId]?.office ?? "eca"].place;

/** Remarks staff can add with one tap, by what the line is. These follow the kinds of remarks on real slips, in our own words. */
export const CONDITION_CHIPS = {
  venue: [
    "Please put all tables and chairs back as you found them. Classes start early the next morning.",
    "Switch off the lights and air-conditioning when you leave.",
    "Finish by 22:00. The building closes.",
    "A security officer will unlock the room. Meet them at the entrance.",
  ],
  item: [
    "Collect from the place shown. Bring your campus card.",
    "Return on time. Late returns may count against the club.",
    "Fewer units approved because other clubs have asked too.",
    "Check each unit works before you leave the counter.",
  ],
  care: [
    "Arranged. Contact the office if the plan changes.",
    "Approved for the time shown only.",
  ],
} as const;
