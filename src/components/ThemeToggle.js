"use client";

import { useEffect, useState, useRef } from "react";
import { Sun, Monitor, Moon } from "lucide-react";

const MODES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "auto", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

function applyTheme(mode) {
  let shouldBeDark;
  if (mode === "dark") {
    shouldBeDark = true;
  } else if (mode === "light") {
    shouldBeDark = false;
  } else {
    shouldBeDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.documentElement.classList.toggle("dark", shouldBeDark);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState("auto");
  const mqlRef = useRef(null);

  // Reflect whatever the init script (in layout.js) already applied to
  // <html> on first paint, so this control starts in sync.
  // document doesn't exist during server render, so this can only run
  // after mount — a one-render mismatch followed by a client-side
  // correction is unavoidable, not an oversight.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = (() => {
      try {
        return localStorage.getItem("sentinel-theme");
      } catch {
        return null;
      }
    })();
    setMode(stored === "light" || stored === "dark" ? stored : "auto");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // When mode is "auto", listen for OS preference changes and apply live.
  useEffect(() => {
    if (mode !== "auto") {
      if (mqlRef.current) {
        mqlRef.current.removeEventListener("change", mqlRef.current._handler);
        mqlRef.current = null;
      }
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("auto");
    mql.addEventListener("change", handler);
    mqlRef.current = mql;
    mql._handler = handler;

    return () => {
      mql.removeEventListener("change", handler);
      mqlRef.current = null;
    };
  }, [mode]);

  function select(next) {
    setMode(next);
    applyTheme(next);
    try {
      localStorage.setItem("sentinel-theme", next);
    } catch (e) {}
  }

  const current = MODES.find((m) => m.value === mode) ?? MODES[1];
  const CurrentIcon = current.icon;

  return (
    <div className="relative inline-flex items-center">
      <CurrentIcon
        size={15}
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate"
      />
      <select
        value={mode}
        onChange={(e) => select(e.target.value)}
        aria-label="Theme"
        className="border border-slate/30 rounded-lg bg-surface pl-8 pr-8 py-1.5 text-sm text-ink focus:border-teal transition"
      >
        {MODES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
