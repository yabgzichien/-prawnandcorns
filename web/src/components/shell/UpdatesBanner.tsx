"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AlertTriangle, Bell, RefreshCw, X } from "lucide-react";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { SYSTEM_SHORT, type SystemId } from "@/lib/world/types";
import { SYNC_REVIEW_PROMPT } from "@/lib/sync/review";

const list = (systems: SystemId[]) => {
  const names = systems.map((s) => SYSTEM_SHORT[s]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/**
 * A translucent layer that floats over the page. It appears when a sync finds something new,
 * and it never blocks what is underneath. It materialises (blur and scale) rather than just fading.
 */
export function UpdatesBanner() {
  const { changes, failed, syncNow, syncing } = useCampus();
  const { openAgent, agentOpen } = useApp();
  const [hiddenFor, setHiddenFor] = useState("");
  const signature = changes.map((c) => c.id).join("|") + failed.map((f) => f.system).join(",");
  const visible = (changes.length > 0 || failed.length > 0) && !agentOpen && hiddenFor !== signature;
  const systems = [...new Set(changes.map((c) => c.system))];

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[45] flex justify-center lg:left-[284px]" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -18, scale: 0.97, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, scale: 0.98, filter: "blur(8px)" }}
            transition={SPRING}
            className="glass-thick pointer-events-auto flex w-full max-w-[640px] flex-col gap-2 rounded-[22px] p-2 pl-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
              {changes.length > 0 && (
                <p className="flex items-start gap-2 text-[0.92rem] font-semibold leading-snug tracking-[-0.01em]">
                  <Bell size={17} className="mt-0.5 shrink-0 text-accent" />
                  <span>{changes.length} update{changes.length === 1 ? "" : "s"} from {list(systems)}. Review with Compass?</span>
                </p>
              )}
              {failed.map((f) => (
                <p key={f.system} className="flex items-start gap-2 text-[0.85rem] leading-snug text-label-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange" />
                  <span>{f.error.message} Showing what Compass read earlier.</span>
                </p>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {failed.length > 0 && (
                <button onClick={() => void syncNow()} disabled={syncing} className="press btn btn-sm btn-plain disabled:opacity-40"><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Retry</button>
              )}
              {changes.length > 0 && <button onClick={() => openAgent(SYNC_REVIEW_PROMPT)} className="press btn btn-sm btn-primary">Review</button>}
              <button onClick={() => setHiddenFor(signature)} aria-label="Dismiss for now" className="press grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-label-2"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
