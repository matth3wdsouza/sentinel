"use client";

import { MessageSquareWarning } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import TryExamples from "@/components/TryExamples";
import CompanionLinks from "@/components/CompanionLinks";
import InlineError from "@/components/InlineError";
import TextArea from "@/components/TextArea";
import AnalyseActions from "@/components/AnalyseActions";
import VerdictCard from "@/components/VerdictCard";
import FindingsList from "@/components/FindingsList";
import SeverityChips from "@/components/SeverityChips";
import InfoCallout from "@/components/InfoCallout";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import useInspector from "@/lib/useInspector";
import { analyzeMessage, CATEGORY_CONFIG } from "@/lib/scamAnalyser";
import { SEVERITY_STYLE } from "@/lib/severity";

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
    verdict: "danger",
    label: "Signs of a likely scam",
    explanation:
      "This message combines high-signal scam indicators — requests for codes or account details, money pressure, gift-card or wire payments, secrecy demands, or suspicious links. Do not tap links, send money, reuse credentials, or share codes. Verify through an official channel you found yourself.",
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

  function runAnalysis(text) {
    const analysis = analyzeMessage(text);
    if (!analysis) {
      setResult(null);
      setError("Paste a message to analyse first.");
      return;
    }
    setResult(analysis);
    setError(null);
    clearExpanded();

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
          <TextArea
            value={input}
            onChange={handleChange}
            placeholder="Paste an SMS, email, or chat message here…"
            ariaLabel="Message text"
            rows={7}
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

            {visibleCounts.length > 0 && (
              <ResultCard variant="bare">
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-display font-semibold text-ink mb-3">
                    Indicators found ({result.flags.length})
                  </h3>
                  <SeverityChips
                    rows={visibleCounts.map(([category, count]) => ({
                      severity: CATEGORY_CONFIG[category].severity,
                      label: CATEGORY_CONFIG[category].label,
                      count,
                    }))}
                  />
                </div>
              </ResultCard>
            )}

            {result.flags.length > 0 && (
              <FindingsList
                heading="What was flagged"
                items={result.flags}
                getKey={(flag) => flag.id}
                renderLabel={(flag) => {
                  const style = SEVERITY_STYLE[flag.severity];
                  return (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">
                        {flag.message}
                      </span>
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

            <InfoCallout>
              This tool reports indicators, not proof — a clever scam can slip
              past keyword checks, and a normal message can contain a stray
              keyword. When in doubt, verify through an official channel you
              reached yourself, never the number or link in the message.
              Nothing you paste here leaves your device; only coarse counts
              are logged.
            </InfoCallout>

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