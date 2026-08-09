"use client";

import { useState, useId } from "react";
import { CheckCircle2, XCircle, Info, Terminal } from "lucide-react";
import CopyButton from "@/components/CopyButton";

const VERDICT_CONFIG = {
  success: {
    icon: CheckCircle2,
    rail: "bg-teal",
    chipBg: "bg-teal-light",
    chipText: "text-teal-chip",
  },
  match: {
    icon: CheckCircle2,
    rail: "bg-match",
    chipBg: "bg-match-light",
    chipText: "text-match",
  },
  mismatch: {
    icon: XCircle,
    rail: "bg-mismatch",
    chipBg: "bg-mismatch-light",
    chipText: "text-mismatch-chip",
  },
  neutral: {
    icon: Info,
    rail: "bg-teal",
    chipBg: "bg-teal-light",
    chipText: "text-teal-chip",
  },
  fallback: {
    icon: Terminal,
    rail: "bg-fallback",
    chipBg: "bg-fallback-light",
    chipText: "text-fallback",
  },
};

function DetailRow({ label, value, mono, copyable, onCopy, primary }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${primary ? "py-1.5" : "py-1"}`}>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
        <p
          className={
            primary
              ? `text-sm sm:text-base text-ink font-medium break-all ${mono ? "font-mono" : ""}`
              : `text-sm text-slate break-all ${mono ? "font-mono text-xs" : ""}`
          }
        >
          {value}
        </p>
      </div>
      {copyable && (
        <CopyButton
          value={value}
          label={label}
          onCopy={onCopy}
          className="mt-2 p-2"
        />
      )}
    </div>
  );
}

function ExplanationSection({ label, text }) {
  if (!text) return null;
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-xs uppercase tracking-wide text-slate font-medium">{label}</p>
      <p className="text-sm text-ink mt-0.5">{text}</p>
    </div>
  );
}

// ResultCard has two modes:
//
// Standard (default) — verdict-based layout with a coloured left rail, icon
// chip, heading, detail rows, and optional explanation toggle. Right for any
// module that produces a single clear verdict: HIBP, file integrity, guessability.
//
// Bare (variant="bare") — a plain white/surface card with no rail and no
// verdict chrome. Use this when the content IS the result and forcing it into
// the verdict frame would be misleading: hash tables, fingerprint data grids,
// JWT decoded payloads. The card still gets the shared surface, shadow, and
// border-radius, so it fits the page visually without duplicating those values
// in every module.
export default function ResultCard({
  verdict = "neutral",
  heading,
  details = [],
  explanation,
  variant,   // "bare" opts out of the rail + icon + heading chrome entirely
  children,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const explanationId = useId();

  // Bare variant — surface card only, no verdict chrome. Children own the
  // internal layout completely; details and heading props are ignored.
  if (variant === "bare") {
    return (
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        {children}
      </div>
    );
  }

  // Standard verdict card
  const { icon: Icon, rail, chipBg, chipText } =
    VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.neutral;

  const hasExplanation =
    explanation && (explanation.means || explanation.doesntMean || explanation.action);

  return (
    <div className="relative rounded-xl bg-surface shadow-card overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${rail}`} />

      <div className="pl-6 pr-4 py-4 sm:pl-7 sm:pr-5 sm:py-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`inline-flex p-2 rounded-full ${chipBg} ${chipText}`}>
            <Icon size={17} />
          </span>
          <h3 className="font-display font-semibold text-ink">{heading}</h3>
          {hasExplanation && (
            <button
              onClick={() => setShowHelp((prev) => !prev)}
              aria-label="What this means"
              aria-expanded={showHelp}
              aria-controls={explanationId}
              className="ml-auto shrink-0 rounded-full border border-slate/30 size-7 flex items-center justify-center text-slate hover:text-teal hover:border-teal transition"
            >
              <Info size={13} />
            </button>
          )}
        </div>

        {details.length > 0 && (
          <div className="space-y-1 mb-3">
            {details.map((detail, i) => (
              <DetailRow key={i} {...detail} />
            ))}
          </div>
        )}

        {children}

        {hasExplanation && showHelp && (
          <div id={explanationId} className="mt-4 pt-4 border-t border-slate/20">
            <ExplanationSection label="What this means" text={explanation.means} />
            <ExplanationSection
              label="What this doesn't mean"
              text={explanation.doesntMean}
            />
            <ExplanationSection label="What to do" text={explanation.action} />
          </div>
        )}
      </div>
    </div>
  );
}
