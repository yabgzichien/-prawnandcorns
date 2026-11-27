"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Remember the invoking control, including touch interactions where the
  // browser does not necessarily focus a button before opening the sheet.
  useEffect(() => {
    if (open) return;
    const remember = (event: Event) => {
      const el = event.target;
      // React may auto-focus an input during the opening commit, before this
      // sheet's ref/effects have cleaned up their closed-state listeners.
      if (!(el instanceof HTMLElement) || el.closest('[role="dialog"]') || dialogRef.current?.contains(el)) return;
      const control = el.closest<HTMLElement>('button, a[href], input, [tabindex]');
      if (control) returnFocusRef.current = control;
    };
    document.addEventListener("pointerdown", remember, true);
    document.addEventListener("focusin", remember, true);
    return () => {
      document.removeEventListener("pointerdown", remember, true);
      document.removeEventListener("focusin", remember, true);
    };
  }, [open]);

  const showScrim = !desktop || modalOnDesktop;
  const off = desktop ? { x: "108%", y: 0 } : { x: 0, y: "104%" };

  const restoreFocus = () => {
    // Another dialog opened while this one closed (for example the assistant after the first-run sheet): leave focus there.
    if (document.querySelector('[role="dialog"]')) return;
    const invoker = returnFocusRef.current;
    const accessibleName = invoker?.getAttribute("aria-label");
    // The mobile Ask launcher is conditionally rendered, so its original DOM
    // node may no longer be connected when the exit animation finishes.
    const restored = invoker?.isConnected ? invoker : accessibleName
      ? [...document.querySelectorAll<HTMLElement>("button, a[href]")]
        .find((el) => el.getAttribute("aria-label") === accessibleName && el.getClientRects().length > 0)
      : null;
    restored?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const focusable = () => root ? [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.getClientRects().length > 0) : [];
    const frame = requestAnimationFrame(() => {
      if (showScrim && root && !root.contains(document.activeElement)) (focusable()[0] ?? root).focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab" && showScrim && root) {
        const items = focusable();
        if (!items.length) { e.preventDefault(); root.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, showScrim]);

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const projected = info.offset.y + project(info.velocity.y);
    if (projected > 160) onClose();
  };

  return (
    <AnimatePresence onExitComplete={() => { if (!open) restoreFocus(); }}>
      {open && (
        <>
          {showScrim && (
            <motion.div key="scrim" aria-hidden className="fixed inset-0 z-40" style={{ background: "var(--scrim)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} />
          )}
          <motion.div
            key="sheet"
            ref={dialogRef}
            role="dialog"
            aria-modal={showScrim}
            aria-label={label}
            tabIndex={-1}
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
