"use client";

import { Link } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import CopyButton from "@/components/CopyButton";
import InlineError from "@/components/InlineError";
import TextArea from "@/components/TextArea";
import AnalyseActions from "@/components/AnalyseActions";
import VerdictCard from "@/components/VerdictCard";
import FindingsList from "@/components/FindingsList";
import InfoCallout from "@/components/InfoCallout";
import TryExamples from "@/components/TryExamples";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { analyzeURL } from "@/lib/urlInspector";
import useInspector from "@/lib/useInspector";
import { SEVERITY_STYLE } from "@/lib/severity";

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

const EXAMPLES = [
  {
    label: "Misleading subdomain",
    text: "https://paypal.refund-center.com/login",
    caption:
      "A trusted brand used as a subdomain of another domain — the classic phishing shape.",
  },
  {
    label: "Homograph trick",
    text: "https://www.\u0430pple.com",
    caption:
      "A non-ASCII \u2018a\u2019 that looks identical to a Latin \u2018a\u2019 — browsers encode such hostnames as punycode.",
  },
  {
    label: "Clean URL",
    text: "https://example.com/blog/post-1",
    caption: "A straightforward URL that should trigger none of the heuristics.",
  },
];

export default function URLInspectorPage() {
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
  } = useInspector({ trim: true, onAnalyse: runAnalysis });

  function runAnalysis(value) {
    const analysis = analyzeURL(value);
    if (!analysis) {
      setResult(null);
      setError("That doesn't look like a valid URL. Make sure it includes a scheme (e.g. https://).");
      return;
    }

    setResult(analysis);
    setError(null);
    clearExpanded();

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
          <TextArea
            value={input}
            onChange={handleChange}
            placeholder="https://example.com/login?redirect=https%3A%2F%2Fevil.com"
            ariaLabel="URL to analyse"
            rows={3}
            mono
          />
          <TryExamples examples={EXAMPLES} onLoad={loadExample} />
        </div>

        <AnalyseActions
          onAnalyse={handleAnalyse}
          canAnalyse={canAnalyse}
          onReset={reset}
          showReset={showReset}
        />

        {error && <InlineError>{error}</InlineError>}

        {result && (
          <>
            <VerdictCard config={VERDICT_CONFIG[result.verdict]} />

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
              <FindingsList
                heading={`Detected Issues (${result.flags.length})`}
                items={result.flags}
                getKey={(flag) => flag.type}
                renderLabel={(flag) => {
                  const style = SEVERITY_STYLE[flag.severity];
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className={`size-2 rounded-full shrink-0 ${style.dot}`} />
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-ink">{flag.message}</span>
                    </div>
                  );
                }}
                expanded={expanded}
                onToggle={toggle}
              >
                {(flag) => (
                  <p className="text-sm text-slate leading-relaxed">{flag.detail}</p>
                )}
              </FindingsList>
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

            <InfoCallout>
              This tool analyses URL structure and known phishing patterns. It
              does not check live threat intelligence feeds — always verify
              links before entering credentials.
            </InfoCallout>
          </>
        )}
      </div>
    </ModulePage>
  );
}