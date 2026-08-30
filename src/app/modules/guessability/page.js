"use client";

import { useState, useEffect, useRef } from "react";
import { MAX_PASSWORD_LENGTH } from "@/lib/guessability";
import PasswordField from "@/components/PasswordField";
import ModulePage from "@/components/ModulePage";
import { Button } from "@/components/Button";
import Disclosure from "@/components/Disclosure";
import CompanionLinks from "@/components/CompanionLinks";
import InlineError from "@/components/InlineError";
import { Gauge } from "lucide-react";

const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];

// A continuum (0-4), not a verdict — so this maps onto the three colors
// the app already has (mismatch/fallback/match) as tiers along a scale,
// rather than ResultCard's single-state rail. See the ResultCard-vs-
// dedicated-component discussion before this file.
function tierClasses(score) {
  if (score <= 1) return { fill: "bg-mismatch", text: "text-mismatch" };
  if (score === 2) return { fill: "bg-fallback", text: "text-fallback" };
  return { fill: "bg-match", text: "text-match" };
}

// Shapes zxcvbn-ts's result into the pieces the result view below needs.
// The other three crack-time scenarios and zxcvbn's suggestions are
// prose, not a formal list — this module was already avoiding
// information-overload before the ResultCard question came up, and that
// reasoning carries over to its own dedicated layout.
function buildSummary(result) {
  const [headline, ...rest] = result.crackTimes;

  const otherScenarios = rest
    .map((scenario) => `${scenario.label.toLowerCase()}: ${scenario.display}`)
    .join("; ");

  // The joined list is lowercased so each scenario reads naturally
  // mid-sentence, but it's actually displayed as the start of its own
  // paragraph (under "Other scenarios"), so the very first character
  // still needs a capital — otherwise it reads as a grammar error
  // ("if the site stored it poorly..." with no preceding sentence).
  const otherScenariosCapitalized =
    otherScenarios.charAt(0).toUpperCase() + otherScenarios.slice(1);

  const suggestions = result.suggestions.length
    ? result.suggestions.join(" ")
    : "No specific suggestions from the analysis — nothing about this password's structure stood out as an easy target.";

  return { headline, otherScenarios: otherScenariosCapitalized, suggestions };
}

// The result view has its own shape entirely — a strength meter, not a
// verdict card — so it's a local component in this same file rather than
// a new shared components/ file. Password Generator already set this
// precedent: a result shape used by exactly one module doesn't need to be
// "shared" yet, and extracting it later is a contained follow-up if a
// second module ever needs the same shape.
function GuessabilityResult({ result }) {
  const [showDetail, setShowDetail] = useState(false);
  const tier = tierClasses(result.score);
  const { headline, otherScenarios, suggestions } = buildSummary(result);

  return (
    <div className="rounded-xl bg-surface shadow-card overflow-hidden p-5">
      {result.truncated && (
        <p className="text-xs text-slate mb-3">
          Only the first {MAX_PASSWORD_LENGTH} characters were analyzed.
        </p>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 flex-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i <= result.score ? tier.fill : "bg-slate-light"
              }`}
            />
          ))}
        </div>
        <span className={`text-sm font-semibold shrink-0 ${tier.text}`}>
          {SCORE_LABELS[result.score]}
        </span>
      </div>

      {result.wordPhraseNote && (
        <p className="text-xs text-slate bg-slate-light rounded-lg px-3 py-2.5 mt-3 mb-4">
          All the words here are common dictionary words. The estimate treats
          each word as a randomly chosen piece and combines them, so it can
          overstate how long a well-known phrase takes to guess — attackers
          often try common phrases first.
        </p>
      )}

      {/* zxcvbn's own warning, shown directly rather than tucked behind a
          disclosure — it's actionable feedback the person should see
          immediately, not secondary detail. */}
      {result.warning && (
        <p className="text-sm text-ink mb-3">{result.warning}</p>
      )}

      <div className="pt-3 border-t border-slate/20">
        <p className="text-xs uppercase tracking-wide text-slate">
          Estimated crack time
        </p>
        <p className="text-base font-medium text-ink">{headline.display}</p>
        <p className="text-xs text-slate mt-1">
          This assumes the site hashed it properly — many sites
          don&apos;t.
        </p>
      </div>

      <Disclosure
        label="More detail"
        open={showDetail}
        onToggle={() => setShowDetail((prev) => !prev)}
        className="mt-4"
        buttonClassName="flex items-center gap-1 text-sm text-teal"
        contentClassName="mt-3 pt-3 border-t border-slate/20 space-y-3"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-slate font-medium">
            Other scenarios
          </p>
          <p className="text-sm text-ink mt-0.5">{otherScenarios}.</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate font-medium">
            Suggestions
          </p>
          <p className="text-sm text-ink mt-0.5">{suggestions}</p>
        </div>
        {result.matchedWords.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate font-medium">
              Matched dictionary words
            </p>
            <p className="text-sm text-ink mt-0.5">
              {result.matchedWords.join(", ")}
            </p>
          </div>
        )}
      </Disclosure>
    </div>
  );
}

export default function GuessabilityPage() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  const workerRef = useRef(null);

  // The actual zxcvbn-ts call lives in a Web Worker (guessability.worker.js),
  // not here. Testing showed a real, measured worst case — repeated
  // dictionary words with l33t substitutions took ~11 seconds at the
  // 128-char cap — and a synchronous main-thread call of that length
  // freezes the whole tab, not just feels janky. Running it in a worker
  // keeps the page responsive and lets "Analyzing…" actually render.
  useEffect(() => {
    const worker = new Worker(
      new URL("./guessability.worker.js", import.meta.url)
    );
    worker.onmessage = (event) => {
      if (event.data?.error) {
        setWorkerError(
          "The analysis worker failed. Reload the page and try again."
        );
      } else {
        setResult(event.data);
      }
      setIsAnalyzing(false);
    };
    worker.onerror = (event) => {
      setWorkerError(
        "The analysis worker crashed. Reload the page and try again."
      );
      setIsAnalyzing(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  function handlePasswordChange(e) {
    setPassword(e.target.value);
    setResult(null);
    setWorkerError(null);
  }

  function handleReset() {
    setPassword("");
    setResult(null);
    setWorkerError(null);
  }

  function handleAnalyze() {
    if (!password || isAnalyzing) return;
    setResult(null);
    setWorkerError(null);
    setIsAnalyzing(true);
    workerRef.current.postMessage(password);
  }

  // No saveActivity call anywhere in this file — decision 5. Even a
  // score, tied to a timestamp, reveals more about a real password's
  // actual characteristics than this module should persist.

  return (
    <ModulePage
      icon={Gauge}
      title="Guessability"
      description="Estimate how easily a password could be guessed, with pattern-based feedback."
    >

        <label className="flex items-center justify-between text-sm font-medium mb-1">
          <span>Password to analyze</span>
          <span
            className={`font-normal ${
              password.length >= MAX_PASSWORD_LENGTH
                ? "text-mismatch"
                : "text-slate"
            }`}
          >
            {password.length}/{MAX_PASSWORD_LENGTH}
          </span>
        </label>
        <div className="mb-4">
          <PasswordField
            value={password}
            onChange={handlePasswordChange}
            onEnter={handleAnalyze}
            placeholder="Paste or type a password"
            ariaLabel="Password to analyze"
            maxLength={MAX_PASSWORD_LENGTH}
          />
        </div>

        <p className="text-xs text-slate mb-4">
          This never leaves your device — the analysis runs entirely in your
          browser, and nothing about it is saved.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={handleAnalyze}
            disabled={!password || isAnalyzing}
            loading={isAnalyzing}
            loadingLabel="Analyzing..."
          >
            Analyze password
          </Button>
          {(password || result) && (
            <Button variant="ghost" resetIcon onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {workerError && (
          <div className="mb-4 rounded-xl bg-mismatch-light border border-mismatch/30 px-4 py-3">
            <InlineError>{workerError}</InlineError>
          </div>
        )}

        {result && <GuessabilityResult result={result} />}

        {result && result.score <= 1 && (
          <CompanionLinks
            links={[
              {
                href: "/modules/password-generator",
                label: "Generate a stronger password",
              },
            ]}
          />
        )}
    </ModulePage>
  );
}
