import { acNotices } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock Academic Centre: official academic notices as short structured records. */
export const GET = (request: Request) => mockRespond(request, "ac", acNotices);
