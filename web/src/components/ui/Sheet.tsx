"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { project, useMediaQuery } from "@/lib/hooks";

/**
 * Responsive sheet.
 * - Phone: bottom sheet over a scrim. Drag the grabber to dismiss; the release velocity is projected
 *   (Apple's deceleration model) so a flick closes it, a slow drag snaps back. It exits the way it came in.
 * - Desktop: a floating side panel with NO scrim, so the page behind stays usable (parallel, non-blocking task).
 */
export function Sheet({ open, onClose, label, children, wide = false, modalOnDesktop = false }: { open: boolean; onClose: () => void; label: string; children: ReactNode; wide?: boolean; modalOnDesktop?: boolean }) {
  const desktop = useMediaQuery("(min-width: 900px)");
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const showScrim = !desktop || modalOnDesktop;
  const off = desktop ? { x: "108%", y: 0 } : { x: 0, y: "104%" };

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const projected = info.offset.y + project(info.velocity.y);
    if (projected > 160) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {showScrim && (
            <motion.div key="scrim" aria-hidden className="fixed inset-0 z-40" style={{ background: "var(--scrim)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} />
          )}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal={showScrim}
            aria-label={label}
            className={`glass-thick fixed z-50 flex flex-col overflow-hidden ${desktop ? `bottom-3 right-3 top-3 rounded-[28px] ${wide ? "w-[560px]" : "w-[440px]"}` : "inset-x-0 bottom-0 max-h-[92dvh] min-h-[50dvh] rounded-t-[28px]"}`}
            initial={off}
            animate={{ x: 0, y: 0 }}
            exit={off}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            drag={desktop ? false : "y"}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            {!desktop && (
              <div onPointerDown={(e) => controls.start(e)} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5" aria-hidden>
                <span className="h-[5px] w-9 rounded-full bg-label-3" />
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
