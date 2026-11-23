import { acTimetable } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock Academic Centre: this week's classes. An invented format, not AC's real one. */
export const GET = (request: Request) => mockRespond(request, "ac", acTimetable);
