import { mailMessage } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock university email: the full text of one message. Free text on purpose. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return mockRespond(request, "mail", (world) => mailMessage(world, id));
}
