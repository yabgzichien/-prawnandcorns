import { financeAccount } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock Finance Office: total fees, amount paid and amount outstanding. Invented format. */
export const GET = (request: Request) => mockRespond(request, "finance", financeAccount);
