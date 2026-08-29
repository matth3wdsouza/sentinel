"use client";

import { useState } from "react";
import { Strikethrough, Info } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import Disclosure from "@/components/Disclosure";
import TryExamples from "@/components/TryExamples";
import { Button } from "@/components/Button";
import InlineError from "@/components/InlineError";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import {
  analyzeUnicode,
  DANGER,
  WARNING,
  INFO,
  CATEGORY_CONFIG,
} from "@/lib/unicodeInspector";

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
    verdict: "mismatch",
    label: "Text direction override detected",
    explanation:
      "This text contains bidirectional control characters — the mechanism behind display-spoofing attacks. The text may not show the same order in which it was written. Do not trust what this text appears to say.",
  },
};

const SEVERITY_STYLE = {
  [DANGER]: {
    dot: "bg-mismatch",
    badge: "bg-mismatch-light text-mismatch-chip",
    label: "Danger",
  },
  [WARNING]: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Warning",
  },
  [INFO]: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate",
    label: "Info",
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

const HIGHLIGHT_STYLE = {
  [DANGER]: "bg-mismatch-light text-mismatch-chip",
  [WARNING]: "bg-amber-50 text-amber-700",
  [INFO]: "bg-slate-100 text-slate",
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
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedChars, setExpandedChars] = useState({});
  const [highlightOpen, setHighlightOpen] = useState(false);

  function runAnalysis(text) {
    const analysis = analyzeUnicode(text);
    setResult(analysis);
    setError(null);
    setExpandedChars({});

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

  function handleAnalyse() {
    if (!input) return;
    runAnalysis(input);
  }

  function loadExample(example) {
    setInput(example.text);
    setResult(null);
    setError(null);
    setHighlightOpen(false);
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    setExpandedChars({});
    setHighlightOpen(false);
  }

  function toggleChar(index) {
    setExpandedChars((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const canAnalyse = input.length > 0;
  const showReset = input.length > 0 || result || error;
  const visibleCategories = result
    ? Object.entries(result.categories).filter(([, count]) => count > 0)
    : [];

  return (
    <ModulePage
      icon={Strikethrough}
      title="Hidden Unicode Inspector"
      description="Paste text and reveal invisible or deceptive characters — zero-width spaces, bidi overrides, and look-alike homoglyphs."
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Text to inspect
          </label>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="Paste an email, URL, password, or code snippet…"
            rows={5}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            aria-label="Text to inspect"
            className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:border-teal transition resize-y"
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

        {result && (
          <>
            <ResultCard
              verdict={VERDICT_CONFIG[result.verdict].verdict}
              headingLevel="h2"
              heading={VERDICT_CONFIG[result.verdict].label}
              explanation={{
                means: VERDICT_CONFIG[result.verdict].explanation,
              }}
            />

            {visibleCategories.length > 0 && (
              <ResultCard variant="bare">
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-display font-semibold text-ink mb-3">
                    Found ({result.hiddenCount})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {visibleCategories.map(([category, count]) => {
                      const severity = CATEGORY_CONFIG[category].severity;
                      const style = SEVERITY_STYLE[severity];
                      return (
                        <span
                          key={category}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          {count} × {CATEGORY_CONFIG[category].label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </ResultCard>
            )}

            {result.flagged.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-ink">
                  Character breakdown ({result.flagged.length})
                </h3>
                {result.flagged.map((entry, i) => {
                  const style = SEVERITY_STYLE[entry.severity];
                  const isOpen = expandedChars[i] ?? false;
                  return (
                    <Disclosure
                      key={`${entry.hex}-${entry.category}`}
                      label={
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
                      }
                      open={isOpen}
                      onToggle={() => toggleChar(i)}
                      className="rounded-xl bg-surface shadow-card overflow-hidden"
                      buttonClassName="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate/5 transition"
                      contentClassName="px-4 pb-4"
                    >
                      <p className="text-sm text-slate leading-relaxed first-letter:uppercase">
                        {entry.explanation}
                      </p>
                    </Disclosure>
                  );
                })}
              </div>
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

            <div className="rounded-xl bg-slate/5 border border-slate/20 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="text-slate mt-0.5 shrink-0" />
                <p className="text-xs text-slate leading-relaxed">
                  Invisible characters have legitimate uses — language
                  following a zero-width joiner in Arabic, accent marks, emoji
                  sequences. This tool flags them so you can decide whether
                  their presence makes sense in the text you pasted.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </ModulePage>
  );
}