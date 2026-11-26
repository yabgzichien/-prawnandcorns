import { hash } from "./cohort.ts";
import type { PlannerContext } from "./availability.ts";
import { overlaps } from "./time.ts";
import type { ReplacementAnswers, ReplacementRequest, SlotOption } from "./types.ts";

export type Tally = { works: number; cannot: number; noAnswer: number; total: number; demoStudent: boolean | null };

/** The demo student's own answer for one time, if they answered this round of asking. */
export function demoAnswer(request: ReplacementRequest, option: SlotOption, answers: ReplacementAnswers): boolean | null {
  const a = answers[request.id];
  if (!a || a.stamp !== request.stamp) return null;
  return typeof a.works[option.id] === "boolean" ? a.works[option.id] : null;
}

/**
 * How the class answered for one offered time. The demo student's answer is real (from Compass). The invented
 * classmates answer from their timetables, with a few who say no for other reasons and a few who never answer.
 */
export function tallyOption(ctx: PlannerContext, request: ReplacementRequest, option: SlotOption, answers: ReplacementAnswers): Tally {
  const out: Tally = { works: 0, cannot: 0, noAnswer: 0, total: ctx.cohort.length, demoStudent: null };
  for (const s of ctx.cohort) {
    const busy = s.blocks.some((b) => overlaps(b, option));
    let answer: boolean | null;
    if (s.isDemoStudent) { answer = demoAnswer(request, option, answers); out.demoStudent = answer; }
    else {
      const r = hash(`${s.key}|${request.stamp}|${option.id}`) % 100;
      answer = busy ? (r < 10 ? null : false) : r < 12 ? null : r < 20 ? false : true;
    }
    if (answer === null) out.noAnswer++;
    else if (answer) out.works++;
    else out.cannot++;
  }
  return out;
}
