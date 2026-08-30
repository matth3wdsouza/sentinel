"use client";

import ResultCard from "@/components/ResultCard";

// The page-level verdict card every inspector module renders from its own
// VERDICT_CONFIG entry. Keeps the h2 heading level in one place.
export default function VerdictCard({ config }) {
  return (
    <ResultCard
      verdict={config.verdict}
      headingLevel="h2"
      heading={config.label}
      explanation={{ means: config.explanation }}
    />
  );
}