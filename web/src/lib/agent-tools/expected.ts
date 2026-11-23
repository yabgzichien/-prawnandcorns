import type { NoticeItem } from "../connectors/types.ts";
import { BASE_INBOX } from "../data/inbox.ts";
import { EVENT_BY_ID } from "../world/events.ts";
import type { ExtractedFact } from "../world/types.ts";

/**
 * The offline reader. Each invented email carries a hand-written expected answer, so the scripted
 * agent can "read" it with no internet. Emails typed in the console have no stored answer: for those
 * this returns null, and the agent says it cannot read them offline.
 */
const STORED = new Map<string, ExtractedFact[]>();
for (const m of BASE_INBOX) if (m.expected) STORED.set(`mail:notice:${m.id}`, m.expected);
for (const event of Object.values(EVENT_BY_ID)) {
  for (const effect of event.effects) if (effect.op === "addEmail" && effect.message.expected) STORED.set(`mail:notice:${effect.message.id}`, effect.message.expected);
}

export const expectedFacts = (notice: NoticeItem): ExtractedFact[] | null => (notice.custom ? null : STORED.get(notice.id) ?? null);
