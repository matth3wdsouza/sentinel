"use client";

import { useState } from "react";
import { MessageSquareWarning, Info } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import Disclosure from "@/components/Disclosure";
import TryExamples from "@/components/TryExamples";
import CompanionLinks from "@/components/CompanionLinks";
import { Button } from "@/components/Button";
import InlineError from "@/components/InlineError";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import {
  analyzeMessage,
  DANGER,
  WARNING,
  INFO,
  CATEGORY_CONFIG,
} from "@/lib/scamAnalyser";

const VERDICT_CONFIG = {
  clean: {
    verdict: "success",
    label: "No strong scam indicators found",
    explanation:
      "This message contains none of the common scam hallmarks — no urgency pressure, financial asks, credential or OTP requests, secrecy pressure, impersonation, or suspicious links. Treat this as 'nothing flagged', not a guarantee: a well-crafted scam can still pass a keyword check.",
  },
  suspicious: {
    verdict: "mismatch",
    label: "Some suspicious indicators",
    explanation:
      "This message shows warning-level signs such as urgency language, claiming to be a trusted company, or links. None on their own prove a scam, but combined they are worth treating as a red flag. Verify through official channels before acting.",
  },
  dangerous: {
    verdict: "mismatch",
    label: "Signs of a likely scam",
    explanation:
      "This message combines high-signal scam indicators — requests for codes or account details, money pressure, gift-card or wire payments, secrecy demands, or suspicious links. Do not tap links, send money, reuse credentials, or share codes. Verify through an official channel you found yourself.",
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
    label: "Warning",
  },
  [INFO]: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate",
    label: "Info",
  },
};

// One-click demo fixtures (clicking a shortcut only fills the textarea — the
// user still presses Analyse). Rendering is gated by Settings → Modules.
const EXAMPLES = [
  {
    label: "Smishing: OTP",
    text:
      "Alert: we detected unusual activity on your account. Confirm your " +
      "identity now by sending the verification code to secure your account. " +
      "Do not tell anyone. https://bit.ly/3xYzAbc",
    caption:
      "A classic fraud alert: OTP request, urgency, secrecy pressure, and a shortened link.",
  },
  {
    label: "Gift-card payment",
    text:
      "URGENT: Your package is on hold until you pay the redelivery fee. " +
      "Pay with iTunes gift cards immediately or the parcel will be returned. " +
      "Keep it between us. === THIS IS YOUR LAST CHANCE ===",
    caption:
      "Courier impersonation plus a gift-card fee — both strong scam tells.",
  },
  {
    label: "Prize / lottery",
    text:
      "Congratulations! You have won a prize in our lottery. Claim your " +
      "cashback reward today by paying a small processing fee. Act now before " +
      "the offer expires.",
    caption:
      "A 'you've won' lure — pay a fee to claim a prize is a core scam pattern.",
  },
  {
    label: "Harmless reminder",
    text:
      "Hi, this is a reminder that our meeting moved to Tuesday at 3pm. " +
      "Please bring the notes. See you then!",
    caption:
      "A benign message — none of the scam patterns should be detected here.",
  },
];

export default function ScamMessageAnalyserPage() {
  const moduleId = useModuleId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedFlags, setExpandedFlags] = useState({});

  function runAnalysis(text) {
    const analysis = analyzeMessage(text);
    if (!analysis) {
      setResult(null);
      setError("Paste a message to analyse first.");
      return;
    }
    setResult(analysis);
    setError(null);
    setExpandedFlags({});

    // Privacy invariant: log only coarse category counts and the verdict —
    // never the message text, the links it contains, or quoted phrases.
    saveActivity({
      moduleType: moduleId,
      summary: "Message analysed for scam indicators",
      details: {
        verdict: analysis.verdict,
        flagCount: analysis.flags.length,
        ...analysis.counts,
        urlCount: analysis.urlCount,
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
    setExpandedFlags({});
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    setExpandedFlags({});
  }

  function toggleFlag(f) {
    setExpandedFlags((prev) => ({ ...prev, [f.id]: !prev[f.id] }));
  }

  const canAnalyse = input.length > 0;
  const showReset = input.length > 0 || result || error;
  const visibleCounts = result
    ? Object.entries(result.counts).filter(([, count]) => count > 0)
    : [];

  return (
    <ModulePage
      icon={MessageSquareWarning}
      title="Scam Message Analyser"
      description="Paste a suspicious SMS, email, or message and see which common scam indicators it hits — urgency, money pressure, OTP requests, impersonation, and suspicious links."
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Message text
          </label>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="Paste an SMS, email, or chat message here…"
            rows={7}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            aria-label="Message text"
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

            {visibleCounts.length > 0 && (
              <ResultCard variant="bare">
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-display font-semibold text-ink mb-3">
                    Indicators found ({result.flags.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {visibleCounts.map(([category, count]) => {
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

            {result.flags.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-ink">
                  What was flagged
                </h3>
                {result.flags.map((flag) => {
                  const style = SEVERITY_STYLE[flag.severity];
                  const isOpen = expandedFlags[flag.id] ?? false;
                  return (
                    <Disclosure
                      key={flag.id}
                      label={
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="text-sm font-medium text-ink truncate">
                            {flag.message}
                          </span>
                        </div>
                      }
                      open={isOpen}
                      onToggle={() => toggleFlag(flag)}
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

            <div className="rounded-xl bg-slate/5 border border-slate/20 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="text-slate mt-0.5 shrink-0" />
                <p className="text-xs text-slate leading-relaxed">
                  This tool reports indicators, not proof. A clever scam can
                  slip past keyword checks, and a normal message can contain a
                  stray keyword. When in doubt, verify through an official
                  channel you reached yourself — never the number or link in
                  the message. Nothing you paste here leaves your device, and
                  only coarse counts are saved to your activity log.
                </p>
              </div>
            </div>

            {result.suspiciousUrlCount > 0 && (
              <CompanionLinks
                links={[
                  {
                    href: "/modules/url-inspector",
                    label: "Inspect the link safely",
                  },
                ]}
              />
            )}
          </>
        )}
      </div>
    </ModulePage>
  );
}
