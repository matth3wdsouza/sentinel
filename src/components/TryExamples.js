"use client";

import { useState } from "react";
import { usePreference } from "@/lib/usePreference";

// Key shared with the Settings page toggle. Global: when off, every module
// that renders TryExamples hides its prebuilt sample shortcuts.
const TRY_EXAMPLES_PREFERENCE = "ui.tryExamples";

// Prebuilt sample-input shortcuts. Modules pass their own fixtures and an
// onLoad handler that inserts the sample text (leaving the Analyse action to
// the user). Rendering is gated on the global ui.tryExamples preference.
export default function TryExamples({ examples = [], onLoad }) {
  const [showExamples] = usePreference(TRY_EXAMPLES_PREFERENCE, true);
  const [active, setActive] = useState(null);

  if (!showExamples) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-xs text-slate">Try an example:</span>
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => {
              setActive(example);
              onLoad(example);
            }}
            className="text-xs font-medium text-teal hover:underline"
          >
            {example.label}
          </button>
        ))}
      </div>
      {active && (
        <p className="mt-1.5 text-xs text-slate leading-relaxed">
          {active.caption}
        </p>
      )}
    </div>
  );
}