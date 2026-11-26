import { Briefcase, CalendarOff, Coffee, Cpu, Film, HeartPulse, Landmark, Languages, Leaf, MessagesSquare, Moon, Palette, Sunrise, Wallet, type LucideIcon } from "lucide-react";
import type { Interest, Stream, TimePrefs } from "@/lib/electives/types";

/** One icon for each interest, so a course and a chip about the same thing look the same. */
export const INTEREST_ICON: Record<Interest, LucideIcon> = {
  Languages, Culture: Landmark, Creative: Palette, "Film and media": Film, Money: Wallet, Business: Briefcase,
  Communication: MessagesSquare, Health: HeartPulse, Nature: Leaf, Technology: Cpu,
};

export const PREF_ICON: Record<keyof TimePrefs, LucideIcon> = { noSaturday: CalendarOff, freeFriday: Coffee, noEvening: Moon, noEarly: Sunrise };

/** The same stream colours as the week preview. Colour is never the only signal: the stream name is always written too. */
export const STREAM_COLOR: Record<Stream, { bg: string; fg: string }> = {
  Science: { bg: "var(--teal-soft)", fg: "var(--teal)" },
  Business: { bg: "var(--orange-soft)", fg: "var(--orange)" },
  Arts: { bg: "var(--purple-soft)", fg: "var(--purple)" },
};

/** A rounded tile with the course's main topic, tinted by its stream. */
export function CourseIcon({ tag, stream, size = 40 }: { tag: Interest | undefined; stream: Stream; size?: number }) {
  const Icon = (tag && INTEREST_ICON[tag]) || Palette;
  const c = STREAM_COLOR[stream];
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl" style={{ width: size, height: size, background: c.bg, color: c.fg }}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.1} />
    </span>
  );
}
