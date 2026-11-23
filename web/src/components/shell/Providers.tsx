"use client";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AppProvider } from "@/lib/state";
import { CampusProvider } from "@/lib/sync/CampusProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CampusProvider>
        <AppProvider>{children}</AppProvider>
      </CampusProvider>
    </MotionConfig>
  );
}
