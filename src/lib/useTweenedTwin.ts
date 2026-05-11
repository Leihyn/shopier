"use client";

import { useEffect, useRef, useState } from "react";
import type { SilhouetteTwin } from "@/components/twin/TwinSilhouette";

const NUMERIC_KEYS = [
  "heightCm",
  "chestCm",
  "waistCm",
  "hipCm",
  "inseamCm",
  "shoulderCm",
  "skinTone",
] as const;

type NumericKey = (typeof NUMERIC_KEYS)[number];

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly tweens the numeric fields of a SilhouetteTwin between renders.
 * Categorical fields (undertone) snap immediately. Numeric fields ease over
 * `durationMs` so the silhouette feels fluid as the user drags sliders.
 */
export function useTweenedTwin(
  target: SilhouetteTwin,
  durationMs = 220
): SilhouetteTwin {
  const [current, setCurrent] = useState<SilhouetteTwin>(target);
  const startRef = useRef<SilhouetteTwin>(target);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = current;
    startTimeRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const k = easeOutCubic(t);
      const next: SilhouetteTwin = { ...target };
      for (const key of NUMERIC_KEYS) {
        const from = startRef.current[key as NumericKey] ?? 0;
        const to = target[key as NumericKey] ?? 0;
        (next as Record<NumericKey, number>)[key] = from + (to - from) * k;
      }
      setCurrent(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    target.heightCm,
    target.weightKg,
    target.chestCm,
    target.waistCm,
    target.hipCm,
    target.inseamCm,
    target.shoulderCm,
    target.skinTone,
    target.undertone,
  ]);

  return current;
}
