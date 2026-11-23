/** The prompt the "Review with Compass" banner hands to the agent. Both agent modes recognise it. */
export const SYNC_REVIEW_PROMPT = "Review my latest campus updates";

/**
 * Deliberately narrow, so phrases that already reached other answers (class changes, the dashboard layout,
 * deadlines) keep going there: it needs "latest/new/recent/campus/sync updates", "what changed" or "what's new".
 */
export const isSyncReviewPrompt = (prompt: string): boolean =>
  /\b(review|show|check|see)\b[^.?!]{0,25}\b(latest|new|recent|campus|sync)\s+(campus\s+)?(updates?|changes)\b|\bwhat('?s| has| have)?\s*changed\b|\bwhat'?s new\b/i.test(prompt);
