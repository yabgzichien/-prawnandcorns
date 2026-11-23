/** The prompt the "Review with Compass" banner hands to the agent. Both agent modes recognise it. */
export const SYNC_REVIEW_PROMPT = "Review my latest campus updates";

export const isSyncReviewPrompt = (prompt: string): boolean =>
  /\b(review|show|check)\b.{0,30}\b(latest|new|recent)?\s*(campus\s+)?(updates|changes)\b|\bwhat('?s| has| have)?\s*changed\b|\bwhat'?s new\b/i.test(prompt);
