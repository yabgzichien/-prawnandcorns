"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Landmark, Loader2, Mail, Plug, RefreshCw, Unplug, BookOpen } from "lucide-react";
import { CONNECTORS } from "@/lib/connectors/connectors";
import { SPRING } from "@/lib/hooks";
import { useCampus } from "@/lib/sync/CampusProvider";
import { SYSTEM_IDS, SYSTEM_LABEL, type SystemId } from "@/lib/world/types";
import { Item, PageHeader, Pill, Stagger } from "@/components/ui/kit";
import { ConsentSheet } from "./ConsentSheet";

export const SYSTEM_ICON: Record<SystemId, typeof BookOpen> = { moodle: BookOpen, ac: CalendarDays, finance: Landmark, mail: Mail };
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

export function ConnectionsView() {
  const { connections, connected, syncing, syncNow, disconnect, failed, snapshot, lastSyncAt, hydrated } = useCampus();
  const [asking, setAsking] = useState<SystemId | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Demo connections"
        title="Connections"
        sub="Compass reads four invented campus systems, the same way it would read the real ones. Each is read only and none is a real XMUM system."
        action={
          <button onClick={() => void syncNow()} disabled={!connected.length || syncing} className="press btn btn-primary disabled:opacity-40">
            {syncing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} {syncing ? "Syncing" : "Sync now"}
          </button>
        }
      />

      <Stagger className="space-y-3">
        {SYSTEM_IDS.map((system) => {
          const Icon = SYSTEM_ICON[system];
          const on = Boolean(connections[system]);
          const problem = failed.find((f) => f.system === system);
          const last = snapshot?.fetchedAt[system];
          return (
            <Item key={system}>
              <section className="card flex flex-wrap items-center gap-4 p-4 sm:p-5" aria-label={SYSTEM_LABEL[system]}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: problem ? "var(--orange-soft)" : on ? "var(--green-soft)" : "var(--surface-3)", color: problem ? "var(--orange)" : on ? "var(--green)" : "var(--label-2)" }}>
                  {problem ? <AlertTriangle size={22} /> : on ? <CheckCircle2 size={22} /> : <Icon size={22} />}
                </span>
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <p className="t-headline flex flex-wrap items-center gap-2">
                    {SYSTEM_LABEL[system]}
                    {on ? (problem ? <Pill tone="orange">Unavailable</Pill> : <Pill tone="green">Connected</Pill>) : <Pill tone="blue">Not connected</Pill>}
                  </p>
                  <p className="t-sub mt-0.5 break-words">
                    {!hydrated ? "Checking connection" : problem
                      ? `${problem.error.message} Compass is showing what it read ${last ? `at ${timeOf(last)}` : "earlier"}. Try again in a moment.`
                      : on ? (last ? `Last read at ${timeOf(last)}.` : syncing ? "Reading now." : "Connected. Not read yet.")
                        : `Without this, Compass shows built-in example ${system === "mail" ? "emails" : "data"}.`}
                  </p>
                  <p className="t-caption mt-1">{CONNECTORS[system].scopes.join(". ")}</p>
                </div>
                {on ? (
                  <div className="flex flex-wrap gap-2">
                    {problem && <button onClick={() => void syncNow()} disabled={syncing} className="press btn btn-sm btn-tint"><RefreshCw size={14} /> Try again</button>}
                    <button onClick={() => disconnect(system)} className="press btn btn-sm btn-plain"><Unplug size={14} /> Disconnect</button>
                  </div>
                ) : (
                  <button onClick={() => setAsking(system)} disabled={!hydrated} className="press btn btn-primary disabled:opacity-40"><Plug size={16} /> Connect</button>
                )}
              </section>
            </Item>
          );
        })}
      </Stagger>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} className="t-caption mt-6 px-1" aria-live="polite">
        {lastSyncAt ? `Last sync finished at ${timeOf(lastSyncAt)}. ` : ""}Everything Compass reads is invented demo data and is kept in this browser only. Disconnecting removes what Compass read from that system.
      </motion.p>

      <ConsentSheet system={asking} onClose={() => setAsking(null)} />
    </div>
  );
}
