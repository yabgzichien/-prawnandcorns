/** Request headers shared by the mock APIs and the connectors that call them. */
export const HDR_EVENTS = "x-compass-events";
export const HDR_OUTAGE_SEEN = "x-compass-outage-seen";
export const HDR_DATA = "x-compass-data";
export const DATA_STAMP = "fictional-demo";

/** Header value cap: 24 ids of up to ~30 characters each, plus separators. */
export const MAX_HEADER_LENGTH = 1200;

export function parseIdList(value: string | null | undefined): string[] {
  if (!value || value.length > MAX_HEADER_LENGTH) return [];
  return value.split(",").map((part) => part.trim()).filter((part) => /^[a-z0-9-]{1,48}$/.test(part)).slice(0, 24);
}

export const formatIdList = (ids: readonly string[]): string => ids.join(",");
