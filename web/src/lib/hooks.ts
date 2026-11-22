"use client";
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, server = false) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

/** Apple's momentum projection: where a flick at `velocity` px/s would come to rest. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  const sign = overshoot < 0 ? -1 : 1;
  const o = Math.abs(overshoot);
  return (sign * (o * dimension * constant)) / (dimension + constant * o);
}

export const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;
export const SPRING_FAST = { type: "spring", bounce: 0, duration: 0.3 } as const;
export const SPRING_FLICK = { type: "spring", bounce: 0.18, duration: 0.45 } as const;
