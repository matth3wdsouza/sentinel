"use client";

import { Button } from "@/components/Button";

// The standard analyse/reset action row — the primary action plus an
// optional ghost reset. Defaults to "Analyse" for the inspector modules;
// other modules pass a custom actionLabel ("Check password", "Encrypt"…).
// loading/loadingLabel and className (spacing) pass through to the row.
export default function AnalyseActions({
  onAnalyse,
  canAnalyse,
  actionLabel = "Analyse",
  onReset,
  showReset,
  loading = false,
  loadingLabel,
  className = "",
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Button
        onClick={onAnalyse}
        disabled={!canAnalyse}
        loading={loading}
        loadingLabel={loadingLabel}
      >
        {actionLabel}
      </Button>
      {showReset && (
        <Button variant="ghost" resetIcon onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  );
}