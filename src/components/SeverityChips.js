"use client";

import { SEVERITY_STYLE } from "@/lib/severity";

// Severity count chips ("3 × Credential/OTP request") shared by the Scam
// Message Analyser and Hidden Unicode Inspector indicator cards. Styling
// derives from the canonical SEVERITY_STYLE so the dot/badge pairing can't
// drift between modules.
export default function SeverityChips({ rows }) {
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map(({ severity, label, count }) => {
        const style = SEVERITY_STYLE[severity];
        return (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}
          >
            <span className={`size-1.5 rounded-full ${style.dot}`} />
            {count} × {label}
          </span>
        );
      })}
    </div>
  );
}