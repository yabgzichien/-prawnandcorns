import { financeLedger } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock Finance Office: the account statement, with every invoice and receipt. Invented format. */
export const GET = (request: Request) => mockRespond(request, "finance", financeLedger);
