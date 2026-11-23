import { COURSES } from "../data/academics.ts";
import { HDR_EVENTS, HDR_OUTAGE_SEEN, formatIdList } from "../world/headers.ts";
import { SYSTEM_LABEL, type SystemId } from "../world/types.ts";
import { normalizeAc, normalizeFinance, normalizeMail, normalizeMoodle } from "./normalize.ts";
import type { Connector, ConnectorEnv, ConnectorError, ConnectorResult, NoticeItem } from "./types.ts";

/** One adapter per system. Replacing a mock connector with a real one changes nothing else. */

class ConnectorFailure extends Error {
  detail: ConnectorError;
  constructor(detail: ConnectorError) { super(detail.message); this.detail = detail; }
}

const courseIdByCode = new Map(COURSES.map((c) => [c.code, c.id]));

async function getJson<T>(env: ConnectorEnv, system: SystemId, url: string): Promise<T> {
  const label = SYSTEM_LABEL[system];
  let response: Response;
  try {
    response = await env.fetcher(url, {
      headers: { [HDR_EVENTS]: formatIdList(env.events), [HDR_OUTAGE_SEEN]: formatIdList(env.outageSeen) },
      cache: "no-store",
    });
  } catch {
    throw new ConnectorFailure({ code: "network", message: `${label} could not be reached.` });
  }
  if (response.status === 503) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === "object" && "error" in body ? (body as { error?: { event?: unknown; message?: unknown } }).error : undefined;
    throw new ConnectorFailure({
      code: "outage",
      message: typeof error?.message === "string" ? error.message : `${label} is unavailable right now.`,
      outageEvent: typeof error?.event === "string" ? error.event : undefined,
    });
  }
  if (!response.ok) throw new ConnectorFailure({ code: "bad_response", message: `${label} sent an unexpected answer (${response.status}).` });
  try { return await response.json() as T; } catch { throw new ConnectorFailure({ code: "bad_response", message: `${label} sent an unreadable answer.` }); }
}

async function guard(system: SystemId, run: () => Promise<Omit<Extract<ConnectorResult, { ok: true }>, "ok" | "system">>): Promise<ConnectorResult> {
  try { return { ok: true, system, ...(await run()) }; }
  catch (error) {
    if (error instanceof ConnectorFailure) return { ok: false, system, error: error.detail };
    return { ok: false, system, error: { code: "bad_response", message: `${SYSTEM_LABEL[system]} sent something Compass could not read.` } };
  }
}

const ws = (fn: string) => `/api/mock/moodle?wsfunction=${fn}`;

export const moodleConnector: Connector = {
  system: "moodle",
  label: "Moodle",
  scopes: ["Your enrolled courses", "Assignment titles, due dates and whether you have submitted", "Course announcements"],
  fetch: (env) => guard("moodle", async () => {
    const [courses, assignments, events, news] = await Promise.all([
      getJson<Parameters<typeof normalizeMoodle>[0]["courses"]>(env, "moodle", ws("core_enrol_get_users_courses")),
      getJson<Parameters<typeof normalizeMoodle>[0]["assignments"]>(env, "moodle", ws("mod_assign_get_assignments")),
      getJson<Parameters<typeof normalizeMoodle>[0]["events"]>(env, "moodle", ws("core_calendar_get_action_events_by_timesort")),
      getJson<Parameters<typeof normalizeMoodle>[0]["news"]>(env, "moodle", ws("mod_forum_get_forum_discussions")),
    ]);
    return { items: normalizeMoodle({ courses, assignments, events, news }), fetchedAt: env.now() };
  }),
};

export const acConnector: Connector = {
  system: "ac",
  label: "Academic Centre",
  scopes: ["This week's timetable", "Official academic notices"],
  fetch: (env) => guard("ac", async () => {
    const [timetable, notices] = await Promise.all([
      getJson<Parameters<typeof normalizeAc>[0]["timetable"]>(env, "ac", "/api/mock/ac/timetable"),
      getJson<Parameters<typeof normalizeAc>[0]["notices"]>(env, "ac", "/api/mock/ac/notices"),
    ]);
    return { items: normalizeAc({ timetable, notices }, courseIdByCode), fetchedAt: env.now() };
  }),
};

export const financeConnector: Connector = {
  system: "finance",
  label: "Finance Office",
  scopes: ["Your fee balance", "Instalments and their due dates"],
  fetch: (env) => guard("finance", async () => {
    const [account, instalments] = await Promise.all([
      getJson<Parameters<typeof normalizeFinance>[0]["account"]>(env, "finance", "/api/mock/finance/account"),
      getJson<Parameters<typeof normalizeFinance>[0]["instalments"]>(env, "finance", "/api/mock/finance/instalments"),
    ]);
    const { items, account: summary } = normalizeFinance({ account, instalments });
    return { items, account: summary, fetchedAt: env.now() };
  }),
};

/** Message text never changes once sent, so it is fetched once per browser session. */
const bodyCache = new Map<string, string>();
export const clearMailCache = () => bodyCache.clear();

export const mailConnector: Connector = {
  system: "mail",
  label: "University email",
  scopes: ["Sender, subject, date and text of messages in your university inbox"],
  fetch: (env) => guard("mail", async () => {
    const list = await getJson<Parameters<typeof normalizeMail>[0]["list"]>(env, "mail", "/api/mock/mail/messages");
    await Promise.all(list.messages.filter((m) => !bodyCache.has(m.id)).map(async (m) => {
      try {
        const full = await getJson<{ message: { body: string } }>(env, "mail", `/api/mock/mail/messages/${encodeURIComponent(m.id)}`);
        if (typeof full.message?.body === "string") bodyCache.set(m.id, full.message.body);
      } catch (error) {
        if (error instanceof ConnectorFailure && error.detail.code === "outage") throw error; // keep the preview for anything else
      }
    }));
    const items = normalizeMail({ list, bodies: bodyCache });
    // Emails the presenter typed into the console live only in this browser. They arrive as untrusted notices.
    for (const c of env.custom) {
      items.push({ id: `mail:notice:${c.id}`, source: "mail", kind: "notice", sender: c.from, subject: c.subject, date: c.date, text: c.body, custom: true } satisfies NoticeItem);
    }
    return { items, fetchedAt: env.now() };
  }),
};

export const CONNECTORS: Record<SystemId, Connector> = { moodle: moodleConnector, ac: acConnector, finance: financeConnector, mail: mailConnector };
