"use client";

import { useState, useEffect, useRef } from "react";
import { getPreference, setPreference } from "./db";

// usePreference(key, defaultValue, options?)
//
// Returns [value, setValue, isLoading] — same shape as useState plus a
// loading flag that is true until the initial IndexedDB read settles.
//
// Callers that need to avoid rendering stale UI before preferences load
// (e.g. to prevent a flicker where all items appear before a hidden-set
// is applied) should gate their render on isLoading === false.
//
// A missing key (fresh install, or after clearPreferences()) resolves to
// defaultValue with isLoading: false — not a stuck loading state.
//
// Options:
//   debounceMs — delay writes (use ~300 for sliders, 0 for toggles/selects).

export function usePreference(key, defaultValue, { debounceMs = 0 } = {}) {
  const [value, setValue] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimer = useRef(null);
  const keyRef = useRef(key);
  // Set to true inside the load effect's .then()/.catch() — not inferred
  // from render/effect ordering assumptions. The write effect checks this
  // to avoid writing the just-loaded value straight back. Safe across
  // React concurrent mode because it only transitions false→true once the
  // async read has fully settled.
  const initialLoadDone = useRef(false);

  useEffect(() => {
    initialLoadDone.current = false;
    setIsLoading(true);
    keyRef.current = key;

    getPreference(key)
      .then((stored) => {
        if (stored !== undefined) {
          setValue(stored);
        }
        initialLoadDone.current = true;
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn(`[usePreference] Failed to load "${key}":`, err);
        initialLoadDone.current = true;
        setIsLoading(false);
      });

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [key]);

  useEffect(() => {
    // Skip during the initial load — we just read this value, no point
    // writing it back.
    if (!initialLoadDone.current) return;

    const doWrite = () => {
      setPreference(keyRef.current, value).catch((err) => {
        console.warn(`[usePreference] Failed to save "${keyRef.current}":`, err);
      });
    };

    if (debounceMs > 0) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(doWrite, debounceMs);
    } else {
      doWrite();
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [value, debounceMs]);

  return [value, setValue, isLoading];
}
