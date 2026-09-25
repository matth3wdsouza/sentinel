"use client";

import { useEffect, useState } from "react";
import { clearPendingPayload, peekPendingPayload } from "@/lib/moduleBridge";

// Read a payload handed to the current module by another module (see
// moduleBridge.js). Returns { value, from } | null.
//
// The value is captured into state during the first render (a pure read —
// nothing is mutated yet), so the returned object is stable for the life of
// this mount: a re-render can't drop it, and the consuming page can safely
// use it to seed its own initial state.
//
// The slot itself is cleared in an effect that only mutates the external
// store (no setState), giving flash-attribute semantics: the payload is
// single-use and can't leak to a later mount of this module. React 19
// StrictMode's double-mount in dev clears an already-cleared slot again —
// an idempotent no-op.
export function useModulePayload(path) {
  const [captured] = useState(() => peekPendingPayload(path) ?? null);

  useEffect(() => {
    if (captured) clearPendingPayload(path);
  }, [captured, path]);

  return captured;
}