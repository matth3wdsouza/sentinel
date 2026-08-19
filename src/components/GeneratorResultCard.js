"use client";

import { Copy, Check, RefreshCw, Info } from "lucide-react";

const STRENGTH_CHIP_CONFIG = {
  mismatch: "bg-mismatch-light text-mismatch-chip",
  fallback: "bg-fallback-light text-fallback",
  match:    "bg-match-light text-match",
  success:  "bg-teal-light text-teal-chip",
  neutral:  "bg-teal-light text-teal-chip",
};

const EXPLANATION_LABELS = {
  means:       "What this means",
  doesntMean:  "What this doesn't mean",
  action:      "What to do",
};

/**
 * The shared "hero" block for continuous/live generator modules (Password
 * Generator, Passphrase Generator).
 *
 * The output display box uses `bg-slate-light` in both modes rather than
 * `bg-teal-light/60` — teal-light/60 reads as near-white in light mode
 * and a strong teal wash in dark mode, which made the two modes feel like
 * different components. Slate-light is neutral in both, lets the monospace
 * text read clearly, and matches the surface language used elsewhere.
 *
 * Props:
 *   result          {string|null} The current generated value; null renders the placeholder.
 *   placeholderText {string}      Shown when result is null.
 *   renderOutput    {(result) => ReactNode} Renders the result into the display box.
 *   copyLabel       {string}      Primary-action button label.
 *   copiedLabel     {string}      Button label while the check icon is showing.
 *   regenerateLabel {string}      Accessible label for the regenerate button.
 *   copied          {boolean}     Whether the copy succeeded (drives the check icon).
 *   onCopy          {() => void}  Fired by the copy button.
 *   onRegenerate    {() => void}  Fired by the regenerate button.
 *   stats           {Array<string>} Read-only stat chips under the output.
 *   chip            {{verdict: string, label: string}?} Strength chip (verdict maps to STRENGTH_CHIP_CONFIG).
 *   showHelp        {boolean}     Whether the explanation section is expanded.
 *   onToggleHelp    {() => void}  Fired by the help toggle.
 *   explanation     {Object?}     { means, doesntMean, action } section text.
 */
export default function GeneratorResultCard({
  result,
  placeholderText,
  renderOutput,
  copyLabel,
  copiedLabel = "Copied",
  regenerateLabel,
  copied,
  onCopy,
  onRegenerate,
  stats = [],
  chip,
  showHelp,
  onToggleHelp,
  explanation,
}) {
  return (
    <div className="p-5 animate-result-reveal">
      {result ? (
        <>
          {/* Output display — neutral surface so it looks consistent in
              both light and dark mode */}
          <div className="rounded-lg bg-slate-light border border-slate/15 px-4 py-4 mb-4">
            <p className="font-mono text-xl sm:text-2xl break-all leading-relaxed text-ink">
              {renderOutput(result)}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={onCopy}
              className="flex-1 flex items-center justify-center gap-2 bg-teal text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal/90 active:scale-[0.98] transition"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? copiedLabel : copyLabel}
            </button>
            <button
              onClick={onRegenerate}
              aria-label={regenerateLabel}
              className="shrink-0 border border-slate/30 rounded-lg size-10 flex items-center justify-center text-slate hover:text-teal hover:border-teal transition"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-slate/20">
            {stats.map((stat, i) => (
              <span key={i} className="text-sm text-slate">
                {stat}
              </span>
            ))}
            {chip && (
              <span
                className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                  STRENGTH_CHIP_CONFIG[chip.verdict] ?? STRENGTH_CHIP_CONFIG.neutral
                }`}
              >
                {chip.label}
              </span>
            )}
            <button
              onClick={onToggleHelp}
              aria-label="What this means"
              aria-expanded={showHelp}
              className="ml-auto shrink-0 rounded-full border border-slate/30 size-7 flex items-center justify-center text-slate hover:text-teal hover:border-teal transition"
            >
              <Info size={13} />
            </button>
          </div>

          {showHelp && explanation && (
            <div className="mt-3 pt-3 border-t border-slate/20 space-y-3">
              {Object.entries(explanation).map(([key, text]) => (
                <div key={key}>
                  <p className="text-xs uppercase tracking-wide text-slate font-medium">
                    {EXPLANATION_LABELS[key] ?? key}
                  </p>
                  <p className="text-sm text-ink mt-0.5">{text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate py-2">{placeholderText}</p>
      )}
    </div>
  );
}
