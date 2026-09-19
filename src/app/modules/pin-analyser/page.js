"use client";

import { useState } from "react";
import ModulePage from "@/components/ModulePage";
import TryExamples from "@/components/TryExamples";
import CompanionLinks from "@/components/CompanionLinks";
import PasswordField from "@/components/PasswordField";
import InlineError from "@/components/InlineError";
import AnalyseActions from "@/components/AnalyseActions";
import VerdictCard from "@/components/VerdictCard";
import FindingsList from "@/components/FindingsList";
import InfoCallout from "@/components/InfoCallout";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import useInspector from "@/lib/useInspector";
import { analyzePIN, MAX_PIN_LENGTH } from "@/lib/pinAnalyser";
import { SEVERITY_STYLE } from "@/lib/severity";

const VERDICT_CONFIG = {
  weak: {
    verdict: "mismatch",
    label: "This PIN is easy to guess",
    explanation:
      "This PIN matches one of the most common codes or follows a pattern guessers reach for first — a repeated digit, straight sequence, known common PIN, or date. If you use this anywhere, change it to something random before a real threat model matters.",
  },
  fair: {
    verdict: "fallback",
    label: "Some weak patterns present",
    explanation:
      "This PIN shows warning-level signs — maybe a sequence, a repeating pair, a date, or a well-known code. None guarantee it is compromised, but they make it more predictable than a random PIN, so it is worth replacing with something pattern-free.",
  },
  strong: {
    verdict: "success",
    label: "No obvious patterns found",
    explanation:
      "This PIN shows none of the common guessable patterns a pattern-based check looks for. 'Nothing flagged' is not a guarantee — a PIN is still limited by its length and by who might see it. Treat it as reasonable, not bulletproof.",
  },
};

// One-click demo fixtures (clicking a shortcut only fills the field — the user
// still presses Analyse). Rendering is gated by Settings → Modules.
const EXAMPLES = [
  {
    label: "Straight sequence",
    text: "1234",
    caption: "Digits step up in order — a guesser favourite.",
  },
  {
    label: "Single repeated digit",
    text: "1111",
    caption: "Only one of ten possible values. Trivial to guess.",
  },
  {
    label: "Keypad walk",
    text: "2580",
    caption: "A straight line down the middle of the keypad.",
  },
  {
    label: "Year / birthday",
    text: "1990",
    caption: "A year someone might find out about you.",
  },
  {
    label: "Repeating pair",
    text: "1212",
    caption: "Cycles through the same two digits.",
  },
  {
    label: "Pattern-free",
    text: "482913",
    caption: "No obvious pattern — this should come back strong.",
  },
];

export default function PinAnalyserPage() {
  const moduleId = useModuleId();

  const {
    input,
    result,
    error,
    setResult,
    setError,
    expanded,
    handleChange,
    handleAnalyse,
    loadExample,
    reset,
    toggle,
    clearExpanded,
    canAnalyse,
    showReset,
  } = useInspector({ onAnalyse: runAnalysis });

  // Bumped on reset to force PasswordField to remount, wiping its internal
  // show/hide state (same pattern as HIBP, Guessability and the common
  // password checker — PasswordField intentionally doesn't expose that).
  const [resetKey, setResetKey] = useState(0);

  function resetAll() {
    reset();
    setResetKey((k) => k + 1);
  }

  function runAnalysis(value) {
    const analysis = analyzePIN(value);
    if (!analysis) {
      setResult(null);
      setError("Enter a PIN to analyse first.");
      return;
    }
    setResult(analysis);
    setError(null);
    clearExpanded();

    if (!analysis.isNumeric) {
      // Still log that a non-numeric value was run, but only coarse data.
      saveActivity({
        moduleType: moduleId,
        summary: "Analyse attempted on non-numeric PIN",
        details: { isNumeric: false },
      });
      return;
    }

    // Privacy invariant: log only the verdict and pattern count — never the
    // PIN itself (nor its length, unique-digit count, or which patterns
    // matched, which would narrow the actual PIN). Guessability, this module's
    // strength-analysis sibling, logs nothing at all.
    saveActivity({
      moduleType: moduleId,
      summary: "PIN analysed for guessable patterns",
      details: {
        verdict: analysis.verdict,
        patternCount: analysis.patterns.length,
      },
    });
  }

  const verdictConfig = result?.verdict ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <ModulePage>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            PIN or passcode
          </label>
          <PasswordField
            key={resetKey}
            value={input}
            onChange={handleChange}
            onEnter={handleAnalyse}
            placeholder="Enter a numeric PIN"
            ariaLabel="PIN or passcode"
            maxLength={MAX_PIN_LENGTH}
            inputMode="numeric"
          />
          <TryExamples examples={EXAMPLES} onLoad={loadExample} />
        </div>

        <AnalyseActions
          onAnalyse={handleAnalyse}
          canAnalyse={canAnalyse}
          onReset={resetAll}
          showReset={showReset}
        />

        {error && <InlineError>{error}</InlineError>}

        {result && !result.isNumeric && (
          <InlineError>
            A PIN is digits only. Clear any letters or symbols and try again.
          </InlineError>
        )}

        {result && result.isNumeric && verdictConfig && (
          <>
            <VerdictCard config={verdictConfig} />

            {result.patterns.length > 0 && (
              <FindingsList
                heading={`What was looked for (${result.patterns.length})`}
                items={result.patterns}
                getKey={(pattern) => pattern.id}
                renderLabel={(pattern) => {
                  const style = SEVERITY_STYLE[pattern.tier];
                  return (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">
                        {pattern.label}
                      </span>
                    </div>
                  );
                }}
                expanded={expanded}
                onToggle={toggle}
              >
                {(pattern) => (
                  <p className="text-sm text-slate leading-relaxed">
                    {pattern.detail}
                  </p>
                )}
              </FindingsList>
            )}

            <InfoCallout>
              This tool reports patterns, not proof — a PIN with no obvious
              pattern can still be guessed or observed, and a flagged
              &apos;pattern&apos; is a likelihood signal, not a certainty.
              Nothing you type here leaves your device; only coarse counts
              are logged, never the PIN itself.
            </InfoCallout>

            {result.verdict !== "strong" && (
              <CompanionLinks
                links={[
                  { href: "/modules/password-generator", label: "Generate a random PIN" },
                  { href: "/modules/guessability", label: "Check a password instead" },
                ]}
              />
            )}
          </>
        )}
      </div>
    </ModulePage>
  );
}