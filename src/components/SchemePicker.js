"use client";

// Colour-scheme picker for Settings. Renders one entry per registered
// scheme in src/lib/colorSchemes.js as a WAI-ARIA radiogroup with roving
// tabindex and arrow-key navigation (same pattern as Tabs.js).
//
// Selection is applied by setting data-scheme on <html> (which switches
// the :root[data-scheme] / .dark[data-scheme] override blocks in
// globals.css) and persisted to localStorage("sentinel-scheme") — same
// store the no-flash init script in layout.js reads before paint.
// Like the theme toggle, this deliberately does not go through IndexedDB
// preferences: it must be readable synchronously before first paint.

import { useEffect, useRef, useState } from "react";
import { COLOR_SCHEMES } from "@/lib/colorSchemes";

const STORAGE_KEY = "sentinel-scheme";

// Module scope so the compiler doesn't treat DOM mutation as a possible
// render side effect (same shape as applyTheme in ThemeToggle).
// "default" removes the attribute so the base :root/:root.dark palette
// applies, mirroring the init script in layout.js.
function applyScheme(id) {
  if (id === "default") {
    delete document.documentElement.dataset.scheme;
  } else {
    document.documentElement.dataset.scheme = id;
  }
}

export default function SchemePicker() {
  const [scheme, setScheme] = useState("default");
  const groupRef = useRef(null);

  // Reflect whatever the init script (in layout.js) already applied to
  // <html> on first paint, so this control starts in sync.
  // document doesn't exist during server render, so this can only run
  // after mount — same unavoidable one-render correction as ThemeToggle.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode etc.) — fall back to default.
    }
    if (stored && COLOR_SCHEMES.some((s) => s.id === stored)) {
      setScheme(stored);
      // data-scheme is already on <html> — the init script applied it
      // before first paint; re-applying here would just fight it.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function select(id) {
    setScheme(id);
    applyScheme(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Non-fatal: scheme still applies for this session.
    }
  }

  function handleKeyDown(e) {
    const index = COLOR_SCHEMES.findIndex((s) => s.id === scheme);
    let nextIndex = null;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIndex = (index + 1) % COLOR_SCHEMES.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIndex = (index - 1 + COLOR_SCHEMES.length) % COLOR_SCHEMES.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = COLOR_SCHEMES.length - 1;

    if (nextIndex === null) return;

    e.preventDefault();
    if (nextIndex === index) return;

    const next = COLOR_SCHEMES[nextIndex];
    select(next.id);
    groupRef.current?.querySelectorAll('[role="radio"]')[nextIndex]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Colour scheme"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
    >
      {COLOR_SCHEMES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={scheme === s.id}
          tabIndex={scheme === s.id ? 0 : -1}
          onClick={() => select(s.id)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition ${
            scheme === s.id
              ? "border-teal bg-teal-light text-teal-chip font-medium"
              : "border-slate/20 text-slate hover:border-slate/40 hover:text-ink"
          }`}
        >
          <span
            aria-hidden="true"
            className="w-4 h-4 rounded-full shrink-0 border border-black/10 dark:border-white/20"
            style={{ backgroundColor: s.swatch }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );
}
