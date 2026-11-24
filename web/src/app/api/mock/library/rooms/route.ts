import { libraryRooms } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock library room booking: every room's two-hour slots for one day (`?date=2026-11-24`). Read only. */
export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  return mockRespond(request, "library", (world) => libraryRooms(world, date));
}
