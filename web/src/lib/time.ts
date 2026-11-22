// A fixed "now" keeps the demo deterministic and hydration-safe.
export const DEMO_NOW = new Date("2026-11-23T13:20:00+08:00");
export const WEEK_START = new Date("2026-11-23T00:00:00+08:00"); // Monday

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// All times are Malaysia time (UTC+8). We format from the offset so output never depends on the viewer's timezone.
function my(d: Date) {
  return new Date(d.getTime() + 8 * 3600_000);
}
export const dayShort = (d: Date) => DAYS[my(d).getUTCDay()];
export const dayLong = (d: Date) => DAYS_LONG[my(d).getUTCDay()];
export const dateShort = (d: Date) => `${my(d).getUTCDate()} ${MONTHS[my(d).getUTCMonth()]}`;
export const timeOf = (d: Date) => {
  const m = my(d);
  return `${String(m.getUTCHours()).padStart(2, "0")}:${String(m.getUTCMinutes()).padStart(2, "0")}`;
};

export function atDay(dayIndexMon0: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(WEEK_START.getTime() + dayIndexMon0 * 86400_000 + (h * 60 + m) * 60_000);
}

export function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function relative(to: Date, from: Date = DEMO_NOW): string {
  const mins = minutesBetween(from, to);
  const abs = Math.abs(mins);
  const sign = mins < 0 ? "ago" : "";
  if (abs < 60) return mins < 0 ? `${abs} min ago` : `in ${abs} min`;
  if (abs < 60 * 24) {
    const h = Math.round(abs / 60);
    return mins < 0 ? `${h} h ago` : `in ${h} h`;
  }
  const d = Math.round(abs / (60 * 24));
  void sign;
  return mins < 0 ? `${d} d ago` : d === 1 ? "tomorrow" : `in ${d} days`;
}

export function dueLabel(d: Date, from: Date = DEMO_NOW) {
  const sameDay = my(d).getUTCDate() === my(from).getUTCDate() && my(d).getUTCMonth() === my(from).getUTCMonth();
  if (sameDay) return `Today, ${timeOf(d)}`;
  return `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}`;
}

export function toICSDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
