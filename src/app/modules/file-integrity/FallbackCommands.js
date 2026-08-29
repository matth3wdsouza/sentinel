"use client";

import { useState, useEffect } from "react";
import CodeBlock from "@/components/CodeBlock";
import { detectLikelyOS, buildCommand } from "@/lib/fallbackCommands";

const OS_LABELS = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
};

export default function FallbackCommands({ algorithm, filenames, extraNote }) {
  const [selectedOS, setSelectedOS] = useState("linux");

  // detectLikelyOS() reads navigator.userAgent, which doesn't exist
  // during Next.js's server render — this can only run after mount, so a
  // one-render "linux" default followed by a client-side correction is
  // unavoidable here, not an oversight.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOS(detectLikelyOS());
  }, []);

  const command = buildCommand(selectedOS, algorithm, filenames);

  // Unknown OS/algorithm combos produce a null command (can't happen with
  // current callers, but render nothing rather than handing CodeBlock null).
  if (!command) return null;

  return (
    <div className="mt-4 p-4 bg-fallback-light rounded-lg text-sm">
      <p className="font-medium text-ink mb-2">
        This file is large, so hashing in the browser may take a little
        while. For big files, running it on your own system is usually
        faster — copy this command and run it locally (the file never has to
        leave your computer).
      </p>

      <div className="flex gap-2 mb-2">
        {Object.entries(OS_LABELS).map(([osKey, label]) => (
          <button
            key={osKey}
            onClick={() => setSelectedOS(osKey)}
            aria-pressed={selectedOS === osKey}
            className={`px-3 py-1 rounded text-xs transition ${
              selectedOS === osKey
                ? "bg-teal text-on-teal"
                : "bg-slate-light text-slate hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <CodeBlock code={command} label={`${algorithm} hash command`} />

      {extraNote && <p className="text-xs text-slate mt-3">{extraNote}</p>}
    </div>
  );
}
