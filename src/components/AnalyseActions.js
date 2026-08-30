"use client";

import { Button } from "@/components/Button";

// The standard Analyse/Reset action row used by every inspector module.
export default function AnalyseActions({ onAnalyse, canAnalyse, onReset, showReset }) {
  return (
    <div className="flex items-center gap-4">
      <Button onClick={onAnalyse} disabled={!canAnalyse}>
        Analyse
      </Button>
      {showReset && (
        <Button variant="ghost" resetIcon onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  );
}