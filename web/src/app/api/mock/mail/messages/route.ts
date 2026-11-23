import { mailList } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock university email: sender, subject, date and a short preview. */
export const GET = (request: Request) => mockRespond(request, "mail", mailList);
