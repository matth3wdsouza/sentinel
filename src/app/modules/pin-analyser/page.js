"use client";

import { useState } from "react";
import { Square, Info } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import Disclosure from "@/components/Disclosure";
import TryExamples from "@/components/TryExamples";
import CompanionLinks from "@/components/CompanionLinks";
import PasswordField from "@/components/PasswordField";
import { Button } from "@/components/Button";
import InlineError from "@/components/InlineError";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import {
  analyzePIN,
  DANGER,
  WARNING,
  INFO,
  MAX_PIN_LENGTH,
} from "@/lib/pinAnalyser";

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

const SEVERITY_STYLE = {
  [DANGER]: {
    dot: "bg-mismatch",
    badge: "bg-mismatch-light text-mismatch-chip",
    label: "High signal",
  },
  [WARNING]: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Pattern",
  },
  [INFO]: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate",
    label: "Info",
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
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedPatterns, setExpandedPatterns] = useState({});

  function runAnalysis(value) {
    const analysis = analyzePIN(value);
    if (!analysis) {
      setResult(null);
      setError("Enter a PIN to analyse first.");
      return;
    }
    setResult(analysis);
    setError(null);
    setExpandedPatterns({});

    if (!analysis.isNumeric) {
      // Still log that a non-numeric value was run, but only coarse data.
      saveActivity({
        moduleType: moduleId,
        summary: "Analyse attempted on non-numeric PIN",
        details: { isNumeric: false },
      });
      return;
    }

    // Privacy invariant: log only the verdict and coarse pattern booleans —
    // never the PIN itself (and never the digit values).
    saveActivity({
      moduleType: moduleId,
      summary: "PIN analysed for guessable patterns",
      details: {
        verdict: analysis.verdict,
        length: analysis.length,
        uniqueDigits: analysis.uniqueDigits,
        patternCount: analysis.patterns.length,
        hasCommon: analysis.patterns.some((p) => p.id === "common-list"),
        hasRepeat: analysis.patterns.some((p) => p.id === "repeat"),
        hasSequence: analysis.patterns.some((p) => p.id === "sequence"),
        hasCouplet: analysis.patterns.some((p) => p.id === "couplet"),
        hasDate: analysis.patterns.some((p) => p.id === "date"),
      },
    });
  }

  function handleAnalyse() {
    if (!input) return;
    runAnalysis(input);
  }

  function loadExample(example) {
    setInput(example.text);
    setResult(null);
    setError(null);
    setExpandedPatterns({});
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    setExpandedPatterns({});
  }

  function togglePattern(p) {
    setExpandedPatterns((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
  }

  const canAnalyse = input.length > 0;
  const showReset = input.length > 0 || result || error;
  const verdictConfig = result?.verdict ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <ModulePage
      icon={Square}
      title="PIN & Pattern Analyser"
      description="Paste a numeric PIN or passcode and see whether it follows the common, guessable patterns — sequences, repeats, dates, keypad walks, and the most leaked codes."
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            PIN or passcode
          </label>
          <PasswordField
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
              setError(null);
            }}
            onEnter={handleAnalyse}
            placeholder="Enter a numeric PIN"
            ariaLabel="PIN or passcode"
            maxLength={MAX_PIN_LENGTH}
          />
          <TryExamples examples={EXAMPLES} onLoad={loadExample} />
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={handleAnalyse} disabled={!canAnalyse}>
            Analyse
          </Button>
          {showReset && (
            <Button variant="ghost" resetIcon onClick={reset}>
              Reset
            </Button>
          )}
        </div>

        {error && <InlineError>{error}</InlineError>}

        {result && !result.isNumeric && (
          <InlineError>
            A PIN is digits only. Clear any letters or symbols and try again.
          </InlineError>
        )}

        {result && result.isNumeric && verdictConfig && (
          <>
            <ResultCard
              verdict={verdictConfig.verdict}
              heading={verdictConfig.label}
              explanation={{ means: verdictConfig.explanation }}
            />

            {result.patterns.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-ink">
                  What was looked for ({result.patterns.length})
                </h3>
                {result.patterns.map((pattern) => {
                  const style = SEVERITY_STYLE[pattern.tier];
                  const isOpen = expandedPatterns[pattern.id] ?? false;
                  return (
                    <Disclosure
                      key={pattern.id}
                      label={
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}
                          >
                            {style.label}
                          </span>
                          <span className="text-sm font-medium text-ink truncate">
                            {pattern.label}
                          </span>
                        </div>
                      }
                      open={isOpen}
                      onToggle={() => togglePattern(pattern)}
                      className="rounded-xl bg-surface shadow-card overflow-hidden"
                      buttonClassName="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate/5 transition"
                      contentClassName="px-4 pb-4"
                    >
                      <p className="text-sm text-slate leading-relaxed">
                        {pattern.detail}
                      </p>
                    </Disclosure>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl bg-slate/5 border border-slate/20 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="text-slate mt-0.5 shrink-0" />
                <p className="text-xs text-slate leading-relaxed">
                  This tool reports patterns, not proof. A PIN with no obvious
                  pattern can still be guessed or observed, and a &apos;pattern&apos;
                  like a sequence or a date is a likelihood signal, not a
                  certainty. Nothing you type here ever leaves your device,
                  and only coarse counts are saved to your activity log — the
                  PIN itself is never logged.
                </p>
              </div>
            </div>

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
