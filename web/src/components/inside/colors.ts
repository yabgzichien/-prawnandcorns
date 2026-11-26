import type { SpaceKind } from "../../lib/data/interiors.ts";

/** Floor colours by kind of space (taken from the tour's photos: cream tiles, wood in the library, grey walkways). */
export const FLOOR: Record<SpaceKind, string> = {
  classroom: "#f1ece2",
  study: "#efe2c6",
  office: "#e8e4dc",
  lab: "#dfe7ec",
  library: "#e3c99b",
  food: "#eedfc6",
  shop: "#e6dccb",
  hall: "#ebe6dc",
  corridor: "#d8d2c6",
  courtyard: "#b5ad9f",
  stairs: "#cdc6b8",
  entrance: "#d6ccbb",
  atrium: "#f3e7cc",
  feature: "#e2c9a3",
};

/** What each kind is called in the panel. */
export const KIND_LABEL: Record<SpaceKind, string> = {
  classroom: "Classroom",
  study: "Study room",
  office: "Office",
  lab: "Lab",
  library: "Library area",
  food: "Food",
  shop: "Shop",
  hall: "Hall",
  corridor: "Walkway",
  courtyard: "Courtyard",
  stairs: "Stairs",
  entrance: "Entrance",
  atrium: "Atrium",
  feature: "Feature",
};

/** The selected room, in the 3D view and the plan. */
export const SELECTED = "#4fae63";
