import { moodleActionEvents, moodleAnnouncements, moodleAssignments, moodleCourses } from "@/lib/world/payloads";
import { mockRespond } from "@/lib/world/mock-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mock Moodle web service. The function name arrives as `wsfunction`, as it does on the real
 * `webservice/rest/server.php`. Read only. All data is invented.
 */
export function GET(request: Request) {
  const fn = new URL(request.url).searchParams.get("wsfunction");
  switch (fn) {
    case "core_enrol_get_users_courses": return mockRespond(request, "moodle", moodleCourses);
    case "mod_assign_get_assignments": return mockRespond(request, "moodle", moodleAssignments);
    case "core_calendar_get_action_events_by_timesort": return mockRespond(request, "moodle", moodleActionEvents);
    case "mod_forum_get_forum_discussions": return mockRespond(request, "moodle", moodleAnnouncements);
    default: return Response.json({ error: { code: "unknown_function", message: "Unknown wsfunction." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
