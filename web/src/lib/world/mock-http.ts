import { DATA_STAMP, HDR_DATA, HDR_EVENTS, HDR_OUTAGE_SEEN, parseIdList } from "./headers.ts";
import { outageFor } from "./payloads.ts";
import { SYSTEM_LABEL, type SystemId, type World } from "./types.ts";
import { buildWorld } from "./world.ts";

/**
 * Shared behaviour for every mock API:
 * rebuild the world from the event ids in the header, wait a moment so syncing feels real,
 * fail once when an outage event is active, stamp the response as fictional, and only ever read.
 */
const DELAY_MS = 250;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const baseHeaders = { "Cache-Control": "no-store", [HDR_DATA]: DATA_STAMP };

export async function mockRespond(request: Request, system: SystemId, build: (world: World) => unknown | null): Promise<Response> {
  const world = buildWorld(parseIdList(request.headers.get(HDR_EVENTS)));
  await wait(Number(process.env.COMPASS_MOCK_DELAY_MS ?? DELAY_MS));
  const outage = outageFor(world, system, parseIdList(request.headers.get(HDR_OUTAGE_SEEN)));
  if (outage) {
    return Response.json(
      { error: { code: "outage", system, event: outage, message: `${SYSTEM_LABEL[system]} is unavailable right now.` }, notice: "fictional demo data" },
      { status: 503, headers: { ...baseHeaders, "Retry-After": "1" } },
    );
  }
  const body = build(world);
  if (body === null) return Response.json({ error: { code: "not_found", message: "No such record." } }, { status: 404, headers: baseHeaders });
  return Response.json(body, { headers: baseHeaders });
}
