/**
 * The library's bookable rooms: 43 rooms in four kinds, all in block A3 (Level 2 learning commons and Level 3).
 * The room numbers, wings and capacities follow the public layout. Everything about who has booked what is invented.
 * Keep room, wing and level here: a future interior model of the A blocks can reuse this table as it is.
 */

export type RoomCategory = "silent" | "study" | "group" | "success";
export type Wing = "North" | "South" | "East" | "West";

export type LibraryRoom = {
  id: string;
  name: string;
  category: RoomCategory;
  level: 2 | 3;
  wing: Wing;
  capacity: number;
  /** Fewest people allowed, when there is a minimum. */
  minPax?: number;
};

export const CATEGORY_INFO: Record<RoomCategory, { title: string; short: string; blurb: string; tips: string[] }> = {
  silent: {
    title: "Silent study rooms",
    short: "Silent",
    blurb: "Enclosed rooms for one or two people who want to work without distractions.",
    tips: ["Closed door", "Up to 2 people", "North wing, Level 2"],
  },
  study: {
    title: "Study rooms",
    short: "Study",
    blurb: "Open-fronted study spaces with no door. Good for two people and quiet discussion.",
    tips: ["No door", "Up to 2 people", "South wing, Level 2"],
  },
  group: {
    title: "Group discussion rooms",
    short: "Group",
    blurb: "Closed rooms with a round table, for up to four people working together.",
    tips: ["Closed door", "Up to 4 people", "East and West wings, Level 2"],
  },
  success: {
    title: "Student success rooms",
    short: "Success",
    blurb: "Meeting rooms for small teams and presentations. You can borrow a projector from the circulation counter. Room 3 is for 5 to 10 people.",
    tips: ["Closed door", "Rooms 1 and 2 take 4, room 3 takes 5 to 10", "West wing, Level 3"],
  },
};

const range = (prefix: string, from: number, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${from + i}`);

export const LIBRARY_ROOMS: LibraryRoom[] = [
  ...range("N", 201, 14).map((id): LibraryRoom => ({ id, name: `Silent study room ${id}`, category: "silent", level: 2, wing: "North", capacity: 2 })),
  ...range("S", 221, 14).map((id): LibraryRoom => ({ id, name: `Study room ${id}`, category: "study", level: 2, wing: "South", capacity: 2 })),
  ...range("E", 231, 6).map((id): LibraryRoom => ({ id, name: `Group discussion room ${id}`, category: "group", level: 2, wing: "East", capacity: 4 })),
  ...range("W", 241, 6).map((id): LibraryRoom => ({ id, name: `Group discussion room ${id}`, category: "group", level: 2, wing: "West", capacity: 4 })),
  { id: "SSR1", name: "Student success room 1", category: "success", level: 3, wing: "West", capacity: 4 },
  { id: "SSR2", name: "Student success room 2", category: "success", level: 3, wing: "West", capacity: 4 },
  { id: "SSR3", name: "Student success room 3", category: "success", level: 3, wing: "West", capacity: 10, minPax: 5 },
];

export const LIBRARY_ROOM_BY_ID: Record<string, LibraryRoom> = Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.id, r]));
export const CATEGORIES: readonly RoomCategory[] = ["silent", "study", "group", "success"];

export const roomCount = (category: RoomCategory) => LIBRARY_ROOMS.filter((r) => r.category === category).length;

/** "Level 2, North wing" */
export const whereIs = (room: LibraryRoom) => `Level ${room.level}, ${room.wing} wing`;
