"use client";

import { useRef, useCallback } from "react";
import { saveActivity } from "@/lib/api";

// Coalesces activity entries for continuously-running analyses (hashing on
// every input pause, QR regen on every tweak). Only logs when the coarse
// length bucket or the discriminative key (algorithm set, content sub-type)
// changed, or the last entry is older than `windowMs` — otherwise one
// document would produce dozens of near-identical rows. Length is bucketed
// (coarse) and content is deliberately never persisted (AGENTS.md privacy
// invariant): the caller decides the coarse metadata it reports via
// `makeEntry`, which returns the saveActivity object sans `moduleType`.
export function useCoalescedActivity(moduleId, { windowMs = 30000, bucketSize = 8 } = {}) {
  const lastLogRef = useRef(null);

  return useCallback(
    (length, key, makeEntry) => {
      const now = Date.now();
      const lengthBucket = Math.round(length / bucketSize) * bucketSize;
      const lastLog = lastLogRef.current;
      const shouldLog =
        !lastLog ||
        lastLog.key !== key ||
        lastLog.lengthBucket !== lengthBucket ||
        now - lastLog.at > windowMs;

      if (shouldLog) {
        lastLogRef.current = { key, lengthBucket, at: now };
        saveActivity({ moduleType: moduleId, ...makeEntry() });
      }
    },
    [moduleId, windowMs, bucketSize]
  );
}