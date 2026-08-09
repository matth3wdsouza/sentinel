"use client";

import { useEffect, useRef, useState } from "react";

// Consolidates the [copied, setCopied] + navigator.clipboard.writeText +
// setTimeout pattern that was previously duplicated across the module pages
// and the CopyButton / CodeBlock / ResultCard components.
//
// Usage:
//   const [copied, copy] = useCopyToClipboard();
//   copy("some text");   // writes to clipboard, flips copied for `timeout` ms
//                        // returns true on success, false if the write failed
export function useCopyToClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
    return true;
  }

  return [copied, copy];
}
