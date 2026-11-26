import { type Interest } from "./types.ts";

/** Words a student might use for each interest. Plain matching, so the same words always give the same answer. */
const WORDS: [Interest, RegExp][] = [
  ["Languages", /\b(languages?|mandarin|chinese language|korean|malay|bahasa|speak(ing)? another)\b/],
  ["Culture", /\b(culture|cultural|history|heritage|calligraphy)\b/],
  ["Creative", /\b(creative|art|arts|drawing|writing|design|craft)\b/],
  ["Film and media", /\b(film|films|movies?|cinema|media|photography|photos?)\b/],
  ["Money", /\b(money|finance|financial|budget(ing)?|invest(ing|ment)?|saving)\b/],
  ["Business", /\b(business|entrepreneur(ship)?|startups?|marketing|accounting)\b/],
  ["Communication", /\b(communication|public speaking|presentations?|negotiat(e|ion|ing)|etiquette)\b/],
  ["Health", /\b(health|healthy|nutrition|fitness|food)\b/],
  ["Nature", /\b(nature|environment(al)?|climate|astronomy|stars|physics)\b/],
  ["Technology", /\b(tech|technology|data|coding|computers?)\b/],
];

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

export const isGeQuestion = (text: string) => /\b(ge|general education|general electives?|electives?)\b/i.test(text);

/** Reads "I need 4 credits of GE and I like languages and film" into a credit target and interests. */
export function parseGeRequest(text: string): { isGeRequest: boolean; credits?: number; interests: Interest[] } {
  const t = (text ?? "").toLowerCase().slice(0, 600);
  const m = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight)\s*(?:-\s*)?(?:credits?|credit hours?|cr|units?)\b/.exec(t);
  const n = m ? (NUMBER_WORDS[m[1]] ?? Number(m[1])) : 0;
  const credits = n >= 1 && n <= 8 ? n : undefined;
  // "arts" as a stream name is not an interest when the student says "arts electives"
  const cleaned = t.replace(/\b(business|arts|science) (stream|electives?)\b/g, " ");
  return { isGeRequest: isGeQuestion(text ?? ""), ...(credits ? { credits } : {}), interests: WORDS.filter(([, re]) => re.test(cleaned)).map(([i]) => i) };
}

/** The planner link that opens with the same credits and interests. */
export function plannerHref(credits: number | undefined, interests: readonly Interest[]): string {
  const q = new URLSearchParams({ section: "electives" });
  if (credits) q.set("credits", String(credits));
  if (interests.length) q.set("likes", interests.map((i) => i.split(" ")[0].toLowerCase()).join(","));
  return `/hub?${q}`;
}
