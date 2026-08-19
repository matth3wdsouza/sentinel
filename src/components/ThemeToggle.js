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

  return (
    <div
      className="inline-flex rounded-lg border border-slate/30 overflow-hidden"
      role="radiogroup"
      aria-label="Theme"
    >
      {MODES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          onClick={() => select(value)}
          className={`px-3 py-1.5 text-sm transition ${
            mode === value
              ? "bg-teal-light text-teal-chip"
              : "bg-paper text-slate hover:text-ink"
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
