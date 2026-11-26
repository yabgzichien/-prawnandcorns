import type { AgentContext, AgentEvent } from "../agent";
import type { SelectableGeminiModel } from "../gemini-model-selection";
import { checkEventFit } from "./check";
import { MAX_PICTURE_BYTES } from "./picture";
import { sanitizeFields, type EventReading } from "./read";

/** Shrinks a picture in the browser so a poster is readable but small. Never stored. */
export async function shrinkPicture(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.82, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= MAX_PICTURE_BYTES) return url;
  }
  throw new Error("The picture is too detailed to send. Crop it to the event details and try again.");
}

/**
 * Gemini mode: the picture goes to the bounded picture route, which only fills in fields. The check that
 * follows is the same plain code as for typed text. Errors are thrown so the panel can fall back to Demo.
 */
export async function* runPictureCheck(file: File, ctx: AgentContext, signal: AbortSignal, model?: SelectableGeminiModel): AsyncGenerator<AgentEvent> {
  yield { type: "plan", steps: ["Read the date and time from the picture", "Check your timetable, plans and bookings"] };
  yield { type: "step", index: 0 };
  yield { type: "tool", id: "pic-read", tool: "gemini.read_picture", input: file.name, status: "running" };
  const picture = await shrinkPicture(file);
  const res = await fetch("/api/event-picture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ picture, model }), signal });
  const body = (await res.json().catch(() => ({}))) as { reading?: unknown; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Picture request failed (HTTP ${res.status}).`);
  const raw = (body.reading && typeof body.reading === "object" ? (body.reading as { fields?: unknown }).fields : null);
  const reading: EventReading = sanitizeFields(raw, "picture");
  yield { type: "tool", id: "pic-read", tool: "gemini.read_picture", input: file.name, status: "done", output: reading.missing.length ? `missing ${reading.missing.join(" and ")}` : `${reading.fields.date}, ${reading.fields.start}` };
  yield { type: "step", index: 1 };
  const result = checkEventFit(reading.fields, { thisWeek: ctx.timetable?.classes, studySessions: ctx.studySessions, personalEvents: ctx.personalEvents, bookings: ctx.library?.bookings, assignments: ctx.assignments ?? ctx.campus?.data.assignments });
  const name = reading.fields.title ? `**${reading.fields.title}**` : "this event";
  yield { type: "text", text: result.verdict === "incomplete"
    ? `Gemini could not find the date and start time of ${name} in the picture. Fill them in below and I will check at once.`
    : `Gemini read ${name} from the picture. ${result.headline}${result.warnings[0] && result.verdict !== "past" ? ` ${result.warnings[0].text}` : ""} Check the fields, since a model read them. Nothing is booked.` };
  yield { type: "card", card: { kind: "event-fit", reading, picture: { name: file.name.slice(0, 60), read: true } } };
  yield { type: "done" };
}
