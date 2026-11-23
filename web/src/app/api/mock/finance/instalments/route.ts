import { financeInstalments } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock Finance Office: each posted instalment with amount, due date and status. */
export const GET = (request: Request) => mockRespond(request, "finance", financeInstalments);
