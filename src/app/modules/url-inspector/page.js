"use client";

import { useState } from "react";
import { Link, Info } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import Disclosure from "@/components/Disclosure";
import CopyButton from "@/components/CopyButton";
import { Button } from "@/components/Button";
import InlineError from "@/components/InlineError";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { analyzeURL, DANGER, WARNING, INFO } from "@/lib/urlInspector";

const VERDICT_CONFIG = {
  safe: {
    verdict: "success",
    label: "No issues detected",
    explanation:
      "This URL doesn't trigger any of the heuristics we check for. That doesn't guarantee it's safe — always exercise caution with unfamiliar links.",
  },
  suspicious: {
    verdict: "mismatch",
    label: "Suspicious",
    explanation:
      "This URL triggered one or more warning-level checks. Proceed with caution — it may be legitimate, but the patterns are commonly seen in phishing.",
  },
  dangerous: {
    verdict: "mismatch",
    label: "Dangerous",
    explanation:
      "This URL triggered one or more danger-level checks. Strong indicators of phishing, spoofing, or malicious intent. Do not visit this link.",
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

const URL_PARTS = [
  { key: "protocol", label: "Scheme" },
  { key: "username", label: "Username" },
  { key: "password", label: "Password" },
  { key: "hostname", label: "Hostname" },
  { key: "port", label: "Port" },
  { key: "pathname", label: "Path" },
  { key: "search", label: "Query" },
  { key: "hash", label: "Fragment" },
];

export default function URLInspectorPage() {
  const moduleId = useModuleId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedFlags, setExpandedFlags] = useState({});

  function handleAnalyse() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const analysis = analyzeURL(trimmed);
    if (!analysis) {
      setResult(null);
      setError("That doesn't look like a valid URL. Make sure it includes a scheme (e.g. https://).");
      return;
    }

    setResult(analysis);
    setError(null);
    setExpandedFlags({});

    saveActivity({
      moduleType: moduleId,
      summary: "URL analysed",
      details: {
        verdict: analysis.verdict,
        flagCount: analysis.flags.length,
        scheme: analysis.parsed.protocol,
      },
    });
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    setExpandedFlags({});
  }

  function toggleFlag(index) {
    setExpandedFlags((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const canAnalyse = input.trim().length > 0;
  const showReset = input || result || error;

  return (
    <ModulePage
      icon={Link}
      title="URL Inspector"
      description="Decompose a URL and flag phishing indicators — homograph tricks, suspicious TLDs, and encoded characters."
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            URL to analyse
          </label>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setResult(null); setError(null); }}
            placeholder="https://example.com/login?redirect=https%3A%2F%2Fevil.com"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            aria-label="URL to analyse"
            className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:border-teal transition resize-y font-mono"
          />
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
            {/* Verdict */}
            <ResultCard
              verdict={VERDICT_CONFIG[result.verdict].verdict}
              headingLevel="h2"
              heading={VERDICT_CONFIG[result.verdict].label}
              explanation={{
                means: VERDICT_CONFIG[result.verdict].explanation,
              }}
            />

            {/* Decomposed URL */}
            <ResultCard variant="bare">
              <div className="px-4 py-4 sm:px-5">
                <h3 className="font-display font-semibold text-ink mb-3">
                  Decomposed URL
                </h3>
                <div className="space-y-1.5">
                  {URL_PARTS.map(({ key, label }) => {
                    const value = result.parsed[key];
                    if (!value) return null;
                    return (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3 py-1"
                      >
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-slate">
                            {label}
                          </p>
                          <p className="text-sm text-ink font-mono break-all">
                            {value}
                          </p>
                        </div>
                        <CopyButton
                          value={value}
                          label={label}
                          className="mt-2 p-2"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </ResultCard>

            {/* Flags */}
            {result.flags.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-ink">
                  Detected Issues ({result.flags.length})
                </h3>
                {result.flags.map((flag, i) => {
                  const style = SEVERITY_STYLE[flag.severity];
                  const isOpen = expandedFlags[i] ?? false;
                  return (
                    <Disclosure
                      key={flag.type}
                      label={
                        <div className="flex items-center gap-2.5">
                          <span className={`size-2 rounded-full shrink-0 ${style.dot}`} />
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {flag.message}
                          </span>
                        </div>
                      }
                      open={isOpen}
                      onToggle={() => toggleFlag(i)}
                      className="rounded-xl bg-surface shadow-card overflow-hidden"
                      buttonClassName="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate/5 transition"
                      contentClassName="px-4 pb-4"
                    >
                      <p className="text-sm text-slate leading-relaxed">
                        {flag.detail}
                      </p>
                    </Disclosure>
                  );
                })}
              </div>
            )}

            {/* Query Parameters */}
            {result.parsed.searchParams && [...result.parsed.searchParams].length > 0 && (
              <ResultCard variant="bare">
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-display font-semibold text-ink mb-3">
                    Query Parameters
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate/20">
                          <th className="text-left py-2 pr-4 text-xs uppercase tracking-wide text-slate font-medium">
                            Key
                          </th>
                          <th className="text-left py-2 text-xs uppercase tracking-wide text-slate font-medium">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.parsed.searchParams].map(([key, value]) => (
                          <tr key={key} className="border-b border-slate/10 last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs text-ink">
                              {key}
                            </td>
                            <td className="py-2 font-mono text-xs text-ink break-all">
                              {value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ResultCard>
            )}

            {/* Tips */}
            <div className="rounded-xl bg-slate/5 border border-slate/20 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="text-slate mt-0.5 shrink-0" />
                <p className="text-xs text-slate leading-relaxed">
                  This tool analyses URL structure and known phishing patterns.
                  It does not check live threat intelligence feeds — always verify
                  links before entering credentials.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </ModulePage>
  );
}
