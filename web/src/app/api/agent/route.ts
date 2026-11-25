import { runGeminiWithFallback } from "@/lib/gemini-agent";
import { executeDemoTool, sanitizeDemoContext } from "@/lib/gemini-tools";
import { isAllowedAgentOrigin } from "@/lib/agent-origin";
import { readJsonBodyWithinLimit, RequestBodyTooLargeError } from "@/lib/request-body";
import { GEMINI_MODEL_CHOICES, fallbackForGeminiModel, isSelectableGeminiModel, resolveGeminiModel } from "@/lib/gemini-model-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MODEL = () => process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const FALLBACK_MODEL = () => process.env.GEMINI_FALLBACK_MODEL?.trim() || "gemini-2.5-flash";
const configured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

export function GET() {
  return Response.json({ configured: configured(), model: MODEL(), fallbackModel: FALLBACK_MODEL(), selectableModels: GEMINI_MODEL_CHOICES, data: "fictional_demo" }, { headers });
}

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (process.env.GEMINI_ENABLE_REMOTE !== "true" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    return Response.json({ error: "Remote Gemini requests are disabled for this local-only prototype." }, { status: 403, headers });
  }
  if (!configured()) return Response.json({ error: "Gemini API key not configured. Use Demo mode or set GEMINI_API_KEY in web/.env.local." }, { status: 503, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON required." }, { status: 415, headers });
  if (Number(request.headers.get("content-length") || 0) > 16_384) return Response.json({ error: "Request too large." }, { status: 413, headers });
  // Next may normalize request.url to localhost even if a local browser uses
  // 127.0.0.1; allow only matching-port loopback aliases in local preview.
  const origin = request.headers.get("origin");
  if (!isAllowedAgentOrigin(origin, request.url, process.env.GEMINI_ENABLE_REMOTE === "true")) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403, headers });
  }

  try {
    const raw: unknown = await readJsonBodyWithinLimit(request, 16_384);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return Response.json({ error: "Invalid request." }, { status: 400, headers });
    const body = raw as Record<string, unknown>;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 1 || prompt.length > 1200) return Response.json({ error: "Enter a question of at most 1200 characters." }, { status: 400, headers });
    const model = resolveGeminiModel(body.model, MODEL());
    if (model === null) return Response.json({ error: "Unsupported Gemini model selection." }, { status: 400, headers });
    const context = sanitizeDemoContext(body.context);
    const result = await runGeminiWithFallback({
      prompt, apiKey: process.env.GEMINI_API_KEY!, model,
      fallbackModel: isSelectableGeminiModel(body.model) ? fallbackForGeminiModel(body.model) : FALLBACK_MODEL(),
      signal: request.signal,
      executeTool: (name, args) => executeDemoTool(name, args, prompt, context),
    });
    return Response.json({ ...result, saved: false, mode: "gemini", data: "fictional_demo" }, { headers });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request too large." }, { status: 413, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400, headers });
    if (error instanceof TypeError && error.message.includes("encoded data")) return Response.json({ error: "Invalid JSON encoding." }, { status: 400, headers });
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return Response.json({ error: "Gemini did not respond before the request timeout. Please retry or select Demo mode." }, { status: 504, headers });
    }
    const message = error instanceof Error ? error.message : "Gemini could not complete the request.";
    // Keep upstream responses, credentials, and stack traces away from the browser.
    const safe = /^(Gemini request failed \(HTTP \d+\)|Gemini returned|Gemini did not|Gemini exceeded|Gemini reached|Invalid Gemini|Enter a question|Gemini API key)/.test(message)
      ? message : "Unable to complete the AI request. Try again or switch to Demo mode.";
    return Response.json({ error: safe }, { status: 502, headers });
  }
}
