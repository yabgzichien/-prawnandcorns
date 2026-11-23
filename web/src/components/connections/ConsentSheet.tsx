"use client";

import { Check, Lock, ShieldCheck } from "lucide-react";
import { CONNECTORS } from "@/lib/connectors/connectors";
import { STUDENT } from "@/lib/data/academics";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { SYSTEM_LABEL, type SystemId } from "@/lib/world/types";
import { Sheet } from "@/components/ui/Sheet";

/**
 * A mock sign-in and consent screen. It looks like a permission prompt, not like any real XMUM page,
 * and it never asks for a password. Pressing Allow stores a fake token on this device.
 */
export function ConsentSheet({ system, onClose }: { system: SystemId | null; onClose: () => void }) {
  const { connect } = useCampus();
  const { showToast } = useApp();
  const connector = system ? CONNECTORS[system] : null;
  const label = system ? SYSTEM_LABEL[system] : "";

  const allow = () => {
    if (!system) return;
    const ok = connect(system);
    showToast(ok ? `${label} connected (demo data, read only)` : "Could not save the connection. Check that site storage is enabled.");
    onClose();
  };

  return (
    <Sheet open={system !== null} onClose={onClose} label={`Connect ${label}`} modalOnDesktop>
      <div className="px-6 pb-8 pt-3 lg:pt-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><ShieldCheck size={26} /></span>
        <h2 className="t-title mt-4 !text-[1.6rem]">Connect {label}</h2>
        <p className="t-sub mt-2">Signed in as {STUDENT.name} (demo student). This is a made-up system, so there is no password to enter.</p>

        <h3 className="t-eyebrow mt-6">Compass would like to read</h3>
        <ul className="mt-2 space-y-2.5 text-[0.95rem]">
          {connector?.scopes.map((scope) => (
            <li key={scope} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-green" strokeWidth={3} /><span>{scope}</span></li>
          ))}
        </ul>
        <p className="mt-5 flex gap-3 rounded-2xl bg-surface p-4 text-[0.9rem]">
          <Lock size={18} className="mt-0.5 shrink-0 text-accent" />
          <span>Read only. Compass cannot change anything in {label}. What it reads stays in this browser, and you can disconnect at any time.</span>
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={allow} className="press btn btn-primary w-full">Allow</button>
          <button onClick={onClose} className="press btn btn-plain w-full">Not now</button>
        </div>
        <p className="t-caption mt-5 text-center">Prototype: this simulates a consent step with invented data. No real XMUM system is contacted.</p>
      </div>
    </Sheet>
  );
}
