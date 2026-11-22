import { DEPARTMENTS, type Department } from "./data/life";
import { STUDENT } from "./data/academics";

export type Tone = "formal" | "brief";
export type Draft = { to: Department; subject: string; body: string; tone: Tone };

export function routeDepartment(text: string): { dept: Department; score: number; confidence: number }[] {
  const t = text.toLowerCase();
  const scored = DEPARTMENTS.map((d) => {
    let score = 0;
    for (const k of d.keywords) if (new RegExp(`(^|[^a-z])${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z]|$)`).test(t)) score += k.includes(" ") ? 3 : 2;
    const short = d.name.toLowerCase().replace(/ office| unit| centre| services/g, "");
    if (t.includes(short)) score += 6;
    return { dept: d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const total = scored.reduce((a, b) => a + b.score, 0) || 1;
  return scored.map((s) => ({ ...s, confidence: s.score / total }));
}

/** Pull the "what I need" part out of a prompt like "Draft an email to Finance about my fee instalment". */
export function extractNeed(text: string): string {
  const cleaned = text
    .replace(/^\s*(please\s+)?(can you\s+)?(help me\s+)?(draft|write|compose|prepare)\s+(me\s+)?(an?\s+)?(e-?mail|message|letter)?\s*/i, "")
    .replace(/^(to|for)\s+(the\s+)?[\w&' -]{2,40}?\s+(about|regarding|on|for|asking|to ask|to say|that)\s+/i, "")
    .replace(/^(about|regarding|on)\s+/i, "")
    .trim();
  const out = cleaned || text.trim();
  return out.charAt(0).toLowerCase() + out.slice(1);
}

const ASKS: Record<string, string> = {
  finance: "Could you please confirm the outstanding amount, the due date and the accepted payment methods? If an extension or a different instalment plan is possible, I would be grateful to know the process.",
  aao: "Could you please advise on the next steps and whether any form needs to be submitted? If there is a deadline I should be aware of, please let me know.",
  exam: "Could you please confirm the arrangements and let me know if any supporting documents are required?",
  accom: "Could you please let me know how this can be resolved and who I should follow up with?",
  it: `Could you please help me resolve this, or advise on the steps I should take? My student account ID is ${STUDENT.id}.`,
  eca: "Could you please let me know the registration process and any dates I should keep in mind?",
  counsel: "I would appreciate the chance to book a confidential appointment. Please let me know what times are available.",
};
const DEFAULT_ASK = "Could you please advise me on the next steps? I am happy to provide any further information you need.";

const sentence = (s: string) => {
  const t = s.trim().replace(/[.\s]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1) + ".";
};

export function composeEmail(dept: Department, need: string, tone: Tone = "formal"): Draft {
  const topic = need.replace(/^i (need|want|would like|am writing) (to )?/i, "").trim();
  const shortTopic = topic.length > 56 ? topic.slice(0, 53).replace(/\s+\S*$/, "") + "…" : topic;
  const ask = ASKS[dept.id] ?? DEFAULT_ASK;
  const subject = `${dept.id === "finance" ? "Query" : "Enquiry"}: ${shortTopic.charAt(0).toUpperCase() + shortTopic.slice(1)} (${STUDENT.id})`;
  const intro = `My name is ${STUDENT.name} (${STUDENT.id}), a ${STUDENT.programme} student.`;
  const body = tone === "formal"
    ? `Dear ${dept.name} team,\n\nI hope you are well. ${intro}\n\nI am writing about ${topic}.\n\n${ask}\n\nThank you for your time and help.\n\nKind regards,\n${STUDENT.name}\n${STUDENT.id} · ${STUDENT.programme}`
    : `Hi ${dept.name} team,\n\n${intro} ${sentence(`I'm writing about ${topic}`)}\n\n${ask}\n\nThanks,\n${STUDENT.name} (${STUDENT.id})`;
  return { to: dept, subject, body, tone };
}

export const mailtoHref = (d: Draft) => `mailto:${d.to.email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
