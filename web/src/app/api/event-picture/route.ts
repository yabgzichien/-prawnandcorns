import { isAllowedAgentOrigin } from "@/lib/agent-origin";
import { readJsonBodyWithinLimit, RequestBodyTooLargeError } from "@/lib/request-body";
import { isSelectableGeminiModel } from "@/lib/gemini-model-selection";
import { MAX_PICTURE_BYTES, parsePictureDataUrl, readPictureWithGemini } from "@/lib/eventfit/picture";
import { asMalaysiaIso } from "@/lib/planning";
import { DEMO_NOW } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

// Its own limit, separate from the agent route: a shrunk picture, a model name and nothing else.
const MAX_BODY = MAX_PICTURE_BYTES + 2_000;
const headers = { "Cache-Control": "no-store" };
const MODEL = () => process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/** Reads an event poster into fields. Nothing is stored; the picture is only forwarded to Gemini. */
export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (process.env.GEMINI_ENABLE_REMOTE !== "true" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    return Response.json({ error: "Remote Gemini requests are disabled for this local-only prototype." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON required." }, { status: 415, headers });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return Response.json({ error: "Picture too large." }, { status: 413, headers });
  if (!isAllowedAgentOrigin(request.headers.get("origin"), request.url, process.env.GEMINI_ENABLE_REMOTE === "true")) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403, headers });
  }
  if (!process.env.GEMINI_API_KEY?.trim()) return Response.json({ error: "Gemini API key not configured. Type the date and time instead." }, { status: 503, headers });
  try {
    const raw = (await readJsonBodyWithinLimit(request, MAX_BODY)) as Record<string, unknown> | null;
    const picture = parsePictureDataUrl(raw?.picture);
    if (!picture) return Response.json({ error: "Send a JPEG, PNG or WebP picture." }, { status: 400, headers });
    const reading = await readPictureWithGemini({
      picture, now: asMalaysiaIso(DEMO_NOW.getTime()), apiKey: process.env.GEMINI_API_KEY!,
      model: isSelectableGeminiModel(raw?.model) ? raw.model : MODEL(), signal: request.signal,
    });
    return Response.json({ reading, saved: false, data: "fictional_demo" }, { headers });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Picture too large." }, { status: 413, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400, headers });
    const message = error instanceof Error && /^Gemini (request failed \(HTTP \d+\)|returned)/.test(error.message) ? error.message : "Compass could not read the picture. Type the date and time instead.";
    return Response.json({ error: message }, { status: 502, headers });
  }
}
