import {
  AlarmClock,
  Backpack,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  Compass,
  Cross,
  FlaskConical,
  Globe2,
  GraduationCap,
  Handshake,
  Laptop,
  Lightbulb,
  Map,
  Megaphone,
  Microscope,
  NotebookPen,
  Pencil,
  Ruler,
  Search,
  Settings,
  ShoppingCart,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: LucideIcon[] = [
  AlarmClock,
  Trophy,
  NotebookPen,
  Laptop,
  Pencil,
  Settings,
  Search,
  Brain,
  BookOpen,
  Backpack,
  Ruler,
  Calculator,
  GraduationCap,
  Globe2,
  Handshake,
  ShoppingCart,
  Megaphone,
  ClipboardList,
  Compass,
  Microscope,
  FlaskConical,
  BriefcaseBusiness,
  Lightbulb,
  Map,
  Cross,
  Wrench,
];

const ITEMS = Array.from({ length: 56 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);

  return {
    Icon: ICONS[index % ICONS.length],
    left: column * 13.7 + ((row * 7 + column * 3) % 7) - 4,
    top: row * 17.4 + ((column * 5 + row * 2) % 8) - 8,
    size: 24 + ((index * 7) % 17),
    rotation: ((index * 19) % 35) - 17,
    duration: 18 + ((index * 11) % 13),
    delay: -((index * 17) % 24),
    drift: 22 + ((index * 13) % 22),
  };
});

export function FloatingIconBackground() {
  return (
    <div
      className="floating-icon-background"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 90%, white), var(--bg))",
      }}
    >
      <style>{`
        @keyframes compass-background-float {
          from { transform: translate3d(0, 12px, 0) rotate(var(--icon-rotation)); }
          to { transform: translate3d(0, calc(-1 * var(--float-distance)), 0) rotate(var(--icon-rotation)); }
        }
        .floating-icon-background .floating-icon {
          animation: compass-background-float var(--float-duration) ease-in-out var(--float-delay) infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-icon-background .floating-icon {
            animation: none !important;
            transform: rotate(var(--icon-rotation)) !important;
          }
        }
      `}</style>
      {ITEMS.map(({ Icon, left, top, size, rotation, duration, delay, drift }, index) => (
        <span
          className="floating-icon"
          key={index}
          style={{
            "--icon-left": `${left}%`,
            "--icon-top": `${top}%`,
            "--icon-size": `${size}px`,
            "--icon-rotation": `${rotation}deg`,
            "--float-duration": `${duration}s`,
            "--float-delay": `${delay}s`,
            "--float-distance": `${drift}px`,
            position: "absolute",
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            color: "color-mix(in srgb, var(--label) 14%, transparent)",
            transform: `translate3d(0, 12px, 0) rotate(${rotation}deg)`,
            willChange: "transform",
          } as React.CSSProperties}
        >
          <Icon size={size} strokeWidth={1.35} />
        </span>
      ))}
    </div>
  );
}
