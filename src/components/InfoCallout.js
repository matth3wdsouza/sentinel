"use client";

import { Info } from "lucide-react";

// The "reporting limits, not proof" callout that closes every inspector
// module's results.
export default function InfoCallout({ children }) {
  return (
    <div className="rounded-xl bg-slate/5 border border-slate/20 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Info size={16} className="text-slate mt-0.5 shrink-0" />
        <p className="text-xs text-slate leading-relaxed">{children}</p>
      </div>
    </div>
  );
}