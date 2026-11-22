"use client";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AppProvider } from "@/lib/state";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>{children}</AppProvider>
    </MotionConfig>
  );
}
