"use client";

import { useState, useEffect, useRef } from "react";

import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import Disclosure from "@/components/Disclosure";
import TryExamples from "@/components/TryExamples";
import InlineError from "@/components/InlineError";
import TextArea from "@/components/TextArea";
import AnalyseActions from "@/components/AnalyseActions";
import VerdictCard from "@/components/VerdictCard";
import FindingsList from "@/components/FindingsList";
import SeverityChips from "@/components/SeverityChips";
import InfoCallout from "@/components/InfoCallout";
import ReceivedPayload from "@/components/ReceivedPayload";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { useModulePayload } from "@/lib/useModulePayload";
import useInspector from "@/lib/useInspector";
import { analyzeUnicode, CATEGORY_CONFIG } from "@/lib/unicodeInspector";
import { SEVERITY_STYLE } from "@/lib/severity";

const VERDICT_CONFIG = {
  clean: {
    verdict: "success",
    label: "No suspicious characters found",
    explanation:
      "This text contains no bidi overrides, zero-width characters, soft hyphens, control characters, or look-alike homoglyphs. Info-level marks (combining accents, variation selectors) may still appear in the breakdown below.",
  },
  suspicious: {
    verdict: "mismatch",
    label: "Hidden characters found",
    explanation:
      "This text contains one or more invisible or deceptive characters — zero-width spaces, soft hyphens, control characters, or look-alike homoglyphs. Check the breakdown below before trusting what you see.",
  },
  dangerous: {
    verdict: "danger",
    label: "Text direction override detected",
    explanation:
      "This text contains bidirectional control characters — the mechanism behind display-spoofing attacks. The text may not show the same order in which it was written. Do not trust what this text appears to say.",
  },
};

// How hidden characters are rendered in the "made visible" view. Categories
// with a genuinely invisible glyph get a visible marker; categories whose
// character renders normally are shown as-is but highlighted.
const HIDDEN_MARK = {
  bidi: "⇠",
  zeroWidth: "␣",
  softHyphen: "-",
  control: "▤",
};

// Highlights reuse the shared severity badge tints, keyed by the same
// severity strings the analysis returns.
const HIGHLIGHT_STYLE = {
  danger: SEVERITY_STYLE.danger.badge,
  warning: SEVERITY_STYLE.warning.badge,
  info: SEVERITY_STYLE.info.badge,
};

// One-click demo fixtures (clicking a shortcut only fills the textarea — the
// user still presses Analyse). Rendering is gated by Settings → Modules.
const EXAMPLES = [
  {
    label: "Spoofed filename",
    text: "invoice_\u202Egpj.exe",
    caption:
      "Displays as “invoice_exe.jpg” in a file manager, but it's a Windows executable — a bidi override flipped the extension.",
  },
  {
    label: "Hidden space in password",
    text: "pa\u200Bssword",
    caption:
      "Looks exactly like “password”, but a zero-width space hides inside — it's a different string.",
  },
  {
    label: "Homoglyph lookalike",
    text: "payp\u0430l.com",
    caption:
      "The fourth letter is Cyrillic “а”, not Latin “a” — visually identical in most fonts.",
  },
];

export default function UnicodeInspectorPage() {
  const moduleId = useModuleId();
  const [highlightOpen, setHighlightOpen] = useState(false);

  // Payload hand-off from another module (moduleBridge.js — e.g. URL
  // Inspector's analysed URL when a scan flags punycode/homoglyph hostnames).
  // The hand-off *is* the analyse step (same as URL Inspector): the analysis
  // is synchronous, so seed the input AND the result as initial state — no
  // effects, nothing re-runs.
  const pending = useModulePayload("/modules/unicode-inspector");
  const pendingValue = pending?.value ?? "";
  const [seededAnalysis] = useState(() =>
    pendingValue ? analyzeUnicode(pendingValue) : null
  );

  // Log the hand-off-arrived analysis once — an external-store write, not a
  // state update; the UI result is already shown from initial state. The ref
  // guard is written inside the effect (the sanctioned place per the
  // react-hooks/refs rule) so a React 19 StrictMode remount in dev can't
  // write a duplicate activity entry.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!seededAnalysis || loggedRef.current) return;
    loggedRef.current = true;
    saveActivity({
      moduleType: moduleId,
      summary: "Text analysed for hidden Unicode characters",
      details: {
        verdict: seededAnalysis.verdict,
        flagCount: seededAnalysis.hiddenCount,
        bidiCount: seededAnalysis.categories.bidi,
        zeroWidthCount: seededAnalysis.categories.zeroWidth,
        homoglyphCount: seededAnalysis.categories.homoglyph,
        controlCount: seededAnalysis.categories.control,
      },
    });
  }, [seededAnalysis, moduleId]);

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
  } = useInspector({
    onAnalyse: runAnalysis,
    initialValue: pendingValue,
    initialResult: seededAnalysis,
  });

  function runAnalysis(text) {
    const analysis = analyzeUnicode(text);
    setResult(analysis);
    setError(null);
    clearExpanded();
    setHighlightOpen(false);

    saveActivity({
      moduleType: moduleId,
      summary: "Text analysed for hidden Unicode characters",
      details: {
        verdict: analysis.verdict,
        flagCount: analysis.hiddenCount,
        bidiCount: analysis.categories.bidi,
        zeroWidthCount: analysis.categories.zeroWidth,
        homoglyphCount: analysis.categories.homoglyph,
        controlCount: analysis.categories.control,
      },
    });
  }

  function loadExampleAndResetHighlight(example) {
    loadExample(example);
    setHighlightOpen(false);
  }

  function resetAll() {
    reset();
    setHighlightOpen(false);
  }

  const visibleCategories = result
    ? Object.entries(result.categories).filter(([, count]) => count > 0)
    : [];

  return (
    <ModulePage>
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
            <label className="block text-sm font-medium text-ink">
              Text to inspect
            </label>
            {pending && input === pendingValue && (
              <ReceivedPayload from={pending.from} />
            )}
          </div>
          <TextArea
            value={input}
            onChange={handleChange}
            placeholder="Paste an email, URL, password, or code snippet…"
            ariaLabel="Text to inspect"
            rows={5}
          />
          <TryExamples examples={EXAMPLES} onLoad={loadExampleAndResetHighlight} />
        </div>

        <AnalyseActions
          onAnalyse={handleAnalyse}
          canAnalyse={canAnalyse}
          onReset={resetAll}
          showReset={showReset}
        />

        {error && <InlineError>{error}</InlineError>}

        {result && (
          <>
            <VerdictCard config={VERDICT_CONFIG[result.verdict]} />

            {visibleCategories.length > 0 && (
              <ResultCard variant="bare">
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-display font-semibold text-ink mb-3">
                    Found ({result.hiddenCount})
                  </h3>
                  <SeverityChips
                    rows={visibleCategories.map(([category, count]) => ({
                      severity: CATEGORY_CONFIG[category].severity,
                      label: CATEGORY_CONFIG[category].label,
                      count,
                    }))}
                  />
                </div>
              </ResultCard>
            )}

            {result.flagged.length > 0 && (
              <FindingsList
                heading={`Character breakdown (${result.flagged.length})`}
                items={result.flagged}
                getKey={(entry) => `${entry.hex}-${entry.category}`}
                renderLabel={(entry) => {
                  const style = SEVERITY_STYLE[entry.severity];
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className="min-w-6 size-8 rounded-md border border-slate/30 bg-white flex items-center justify-center font-mono text-sm text-ink">
                        {entry.char}
                      </span>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="font-mono text-xs text-slate">
                        {entry.hex}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">
                        {entry.name}
                      </span>
                      {entry.count > 1 && (
                        <span className="text-xs text-slate shrink-0">
                          ×{entry.count}
                        </span>
                      )}
                    </div>
                  );
                }}
                expanded={expanded}
                onToggle={toggle}
              >
                {(entry) => (
                  <p className="text-sm text-slate leading-relaxed first-letter:uppercase">
                    {entry.explanation}
                  </p>
                )}
              </FindingsList>
            )}

            <Disclosure
              label="Show the text with hidden characters made visible"
              open={highlightOpen}
              onToggle={() => setHighlightOpen((prev) => !prev)}
              className="rounded-xl bg-surface shadow-card overflow-hidden"
              buttonClassName="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-ink hover:bg-slate/5 transition"
              contentClassName="px-4 pb-4"
            >
              <div className="font-mono text-sm text-ink break-words whitespace-pre-wrap leading-7">
                {result.coded.map((entry, i) => {
                  if (!entry.category) return <span key={i}>{entry.char}</span>;
                  const severity = entry.severity;
                  const mark = HIDDEN_MARK[entry.category] ?? entry.char;
                  return (
                    <span
                      key={i}
                      title={`${entry.hex} — ${entry.name}`}
                      className={`rounded px-1 ${HIGHLIGHT_STYLE[severity]}`}
                    >
                      {mark}
                    </span>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate leading-relaxed">
                Highlights mark hidden characters. Markers:{" "}
                <span className="font-mono text-ink">⇠</span> bidi control,{" "}
                <span className="font-mono text-ink">␣</span> zero-width,{" "}
                <span className="font-mono text-ink">-</span> soft hyphen,{" "}
                <span className="font-mono text-ink">▤</span> control
                character. Look-alike homoglyphs and combining marks are
                shown as themselves inside the highlight.
              </p>
            </Disclosure>

            <InfoCallout>
              Invisible characters have legitimate uses — language following a
              zero-width joiner in Arabic, accent marks, emoji sequences. This
              tool flags them so you can decide whether their presence makes
              sense in the text you pasted.
            </InfoCallout>
          </>
        )}
      </div>
    </ModulePage>
  );
}