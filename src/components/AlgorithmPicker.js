"use client";

import { useId } from "react";
import OptionRow from "@/components/OptionRow";

// Algorithm selector shared by the file-integrity and text-hash modules.
// Both pages had a byte-identical standard-list + legacy-toggle block; the
// two constants and the whole JSX now live here. `open`/`onOpenChange` are
// controlled so the parent can keep reset behavior (e.g. collapsing the
// legacy section on a full form reset).

const STANDARD_ALGORITHMS = ["SHA-256", "SHA-384", "SHA-512"];
const LEGACY_ALGORITHMS = ["SHA-1", "MD5"];

export default function AlgorithmPicker({ selected, onToggle, open, onOpenChange }) {
  const panelId = useId();

  return (
    <div>
      <p className="text-sm font-medium mb-2">Algorithms</p>
      <div className="space-y-1">
        {STANDARD_ALGORITHMS.map((algo) => (
          <OptionRow
            key={algo}
            checked={selected.includes(algo)}
            onChange={() => onToggle(algo)}
          >
            {algo}
          </OptionRow>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-sm text-teal mt-2"
      >
        {open ? "Hide" : "Show"} legacy algorithms (MD5, SHA-1)
      </button>

      {open && (
        <div id={panelId} className="mt-2">
          <div className="space-y-1">
            {LEGACY_ALGORITHMS.map((algo) => (
              <OptionRow
                key={algo}
                checked={selected.includes(algo)}
                onChange={() => onToggle(algo)}
              >
                {algo}
              </OptionRow>
            ))}
          </div>
          <p className="text-xs text-slate mt-1">
            MD5 and SHA-1 are no longer considered cryptographically secure,
            but are still commonly published for legacy compatibility.
          </p>
        </div>
      )}
    </div>
  );
}
