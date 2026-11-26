/** Explicit model choices for the localhost-only Gemini demo.
 * These are selectable identifiers, not a promise that a given API key has access.
 */
export const GEMINI_MODEL_CHOICES = [
  { id: "gemini-2.5-flash", label: "Flash (faster)" },
  { id: "gemini-4-hydrogen", label: "Hydrogen (slower)" },
] as const;

export type SelectableGeminiModel = (typeof GEMINI_MODEL_CHOICES)[number]["id"];

export function isSelectableGeminiModel(value: unknown): value is SelectableGeminiModel {
  return typeof value === "string" && GEMINI_MODEL_CHOICES.some((choice) => choice.id === value);
}

/** A client can override the model only with an explicit allowlisted identifier.
 * Omitted model uses the server's existing configuration for compatibility.
 */
export function resolveGeminiModel(requested: unknown, configuredModel: string): string | null {
  if (requested === undefined) return configuredModel;
  return isSelectableGeminiModel(requested) ? requested : null;
}

/** When a user chooses Hydrogen, the faster Flash remains its fallback.
 * Flash should never silently retry using a slower or more expensive model.
 */
export function fallbackForGeminiModel(model: SelectableGeminiModel): SelectableGeminiModel {
  if (model === "gemini-2.5-flash") return "gemini-2.5-flash";
  return "gemini-2.5-flash";
}
