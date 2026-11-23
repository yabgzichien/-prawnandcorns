import type { AgentContext } from "../agent.ts";

/**
 * What the browser sends. Only ids and the student's own plan: which scenario events each system had seen,
 * which updates are waiting, and the study sessions and reminders. The server rebuilds the campus itself,
 * so a tampered browser cannot add an email or change a date. The one text the browser may send is an
 * email the presenter typed into the console, which is capped and always treated as untrusted.
 */
export function campusRequest(context: Pick<AgentContext, "submitted" | "studySessions" | "campus">) {
  const c = context.campus;
  return {
    submitted: context.submitted,
    studySessions: context.studySessions,
    reminders: c?.plan.reminders ?? [],
    personalEvents: c?.plan.personalEvents ?? [],
    ...(c ? {
      campus: {
        asOf: c.asOf ?? {},
        changes: c.changes.map(({ id, system, since, now }) => ({ id, system, since, now })),
        failed: c.failed.map((f) => f.system),
        custom: c.items.flatMap((i) => i.kind === "notice" && i.custom ? [{ id: i.id.replace("mail:notice:", ""), from: i.sender, subject: i.subject, body: i.text, date: i.date }] : []),
      },
    } : {}),
  };
}
