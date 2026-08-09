"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // Reflect whatever the init script (in layout.js) already applied to
  // <html> on first paint, so this button's icon starts in sync.
  // document doesn't exist during server render, so this can only run
  // after mount — a one-render mismatch followed by a client-side
  // correction is unavoidable, not an oversight.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("sentinel-theme", next ? "dark" : "light");
    } catch (e) {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-full border border-slate/30 bg-paper text-ink hover:bg-slate-light transition"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
