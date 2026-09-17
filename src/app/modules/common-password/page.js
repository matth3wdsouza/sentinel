"use client";

import { useState } from "react";
import { matchCommonPassword, loadCommonPasswords } from "@/lib/commonPasswords";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import ResultCard from "@/components/ResultCard";
import PasswordField from "@/components/PasswordField";
import ModulePage from "@/components/ModulePage";
import InlineError from "@/components/InlineError";
import TryExamples from "@/components/TryExamples";
import CompanionLinks from "@/components/CompanionLinks";
import { Button } from "@/components/Button";
import { ShieldX, Info } from "lucide-react";

function getExplanation(analysis) {
  if (analysis.found) {
    return {
      means: (
        <>
          This password is #{analysis.rank.toLocaleString()} on the{" "}
          <a
            href="https://www.ncsc.gov.uk/news/most-hacked-passwords-revealed-as-uk-cyber-survey-exposes-gaps-in-online-security"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal hover:underline"
          >
            NCSC
          </a>
          &apos;s list of the 100,000 most common breached passwords — one of the
          exact strings attackers try first.
        </>
      ),
      doesntMean:
        "This ranking measures how often the exact string has appeared in breach data, not a judgement about you — and it only covers the most frequent passwords, not every weak one.",
      action:
        "Stop using this password anywhere it currently appears, and replace it with a freshly generated one.",
    };
  }
  return {
    means:
      "This password doesn't appear among the 100,000 most common breached passwords.",
    doesntMean:
      "That's a low bar — lists measure how often a password has been seen, not how hard it is to guess. A name-plus-birthday or a keyboard pattern could still be weak without making the list.",
    action:
      "No change needed on commonness grounds — but verify real strength with Guessability, and check for prior breaches with HIBP.",
  };
}

// One-click demo fixtures (clicking a shortcut only fills the password
// field — the user still presses Check). Gated by Settings → Modules.
const EXAMPLES = [
  {
    label: "Most common",
    text: "123456",
    caption: "#1 — the single most-used password in breach data.",
  },
  {
    label: "Keyboard walk",
    text: "qwerty123",
    caption: "A keyboard sequence with digits — firmly inside the top 100,000.",
  },
  {
    label: "Season + year",
    text: "summer2024",
    caption:
      "Not on the list — yet weak: a season plus a year. Lists measure commonness, not guessability — that's the Guessability link's job.",
  },
];

export default function CommonPasswordPage() {
  const moduleId = useModuleId();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  // Becomes true once the bundled list has loaded, so the button's loading
  // label can tell "downloading the list" from "checking your password".
  const [listReady, setListReady] = useState(false);
  // Bumped on reset to force PasswordField to remount, wiping its internal
  // show/hide state (same pattern as HIBP — PasswordField intentionally
  // owns that state itself).
  const [resetKey, setResetKey] = useState(0);

  function handlePasswordChange(e) {
    setPassword(e.target.value);
    setResult(null);
    setError(null);
  }

  function resetForm() {
    setPassword("");
    setResult(null);
    setError(null);
    setResetKey((key) => key + 1);
  }

  function loadExample(example) {
    setPassword(example.text);
    setResult(null);
    setError(null);
  }

  async function handleCheck() {
    if (!password || isChecking) return;
    setError(null);
    setResult(null);
    setIsChecking(true);

    try {
      const list = await loadCommonPasswords();
      setListReady(true);
      const analysis = matchCommonPassword(password, list);
      setResult(analysis);

      // Outcome only — never the password, and not the list position either
      // (a rank, combined with other logged metadata, could narrow down
      // which password this was). Mirrors the HIBP no-breach-counts rule.
      saveActivity({
        moduleType: moduleId,
        summary: analysis.found
          ? "Checked a password — among the 100,000 most common"
          : "Checked a password — not among the 100,000 most common",
        details: { matchFound: analysis.found },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsChecking(false);
    }
  }

  const details = result?.found
    ? [
        {
          label: "Position on the top-100,000 list",
          value: `#${result.rank.toLocaleString()}`,
          primary: true,
        },
      ]
    : [];

  return (
    <ModulePage
      icon={ShieldX}
      title="Common Password Checker"
      description="Check whether a password is among the 100,000 most common breached passwords."
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Password to check
          </label>
          <PasswordField
            key={resetKey}
            value={password}
            onChange={handlePasswordChange}
            onEnter={handleCheck}
            placeholder="Enter a password"
            ariaLabel="Password to check"
          />
          <TryExamples examples={EXAMPLES} onLoad={loadExample} />
        </div>

        <div className="rounded-xl border border-slate/20 bg-surface px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="shrink-0 text-teal mt-0.5" />
            <p className="text-xs text-slate leading-relaxed">
              This check is fully local. The list of common passwords is
              bundled with the app and loaded from the app&apos;s own files —
              your password never leaves this page, and no network request is
              made to anyone.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleCheck}
            disabled={!password || isChecking}
            loading={isChecking}
            loadingLabel={listReady ? "Checking…" : "Loading list…"}
          >
            Check password
          </Button>

          {(password || result || error) && (
            <Button variant="ghost" resetIcon onClick={resetForm}>
              Reset
            </Button>
          )}
        </div>

        {error && (
          <div>
            <InlineError>{error}</InlineError>
            <button
              onClick={handleCheck}
              className="text-sm text-teal mt-2"
            >
              Try again
            </button>
          </div>
        )}

        {result && (
          <ResultCard
            verdict={result.found ? "mismatch" : "success"}
            headingLevel="h2"
            heading={
              result.found
                ? "A very common password"
                : "Not among the most common passwords"
            }
            details={details}
            explanation={getExplanation(result)}
          >
            <CompanionLinks
              links={
                result.found
                  ? [
                      {
                        href: "/modules/password-generator",
                        label: "Generate a new password instead",
                      },
                    ]
                  : [
                      {
                        href: "/modules/guessability",
                        label: "Check how easy it is to guess",
                      },
                      {
                        href: "/modules/hibp",
                        label: "Check for prior breaches",
                      },
                    ]
              }
            />
          </ResultCard>
        )}
      </div>
    </ModulePage>
  );
}