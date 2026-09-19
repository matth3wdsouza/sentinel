"use client";

import { useState, useRef } from "react";
import CompanionLinks from "@/components/CompanionLinks";
import { checkPasswordBreach, sha1Hex } from "@/lib/hibp";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import ResultCard from "@/components/ResultCard";
import PasswordField from "@/components/PasswordField";
import ModulePage from "@/components/ModulePage";
import InlineError from "@/components/InlineError";
import AnalyseActions from "@/components/AnalyseActions";
import { Info } from "lucide-react";

function getExplanation(result) {
  if (result.breached) {
    return {
      means: `This exact password has appeared in known data breaches ${result.count.toLocaleString()} time${
        result.count === 1 ? "" : "s"
      }. Attackers routinely test leaked passwords like this one against other accounts.`,
      doesntMean:
        "This doesn't mean a site you use leaked it specifically — the breach could be from any service that ever used this exact password, including ones you've never had an account with.",
      action:
        "Stop using this password anywhere it currently appears, and replace it with a freshly generated one.",
    };
  }
  return {
    means: (
      <>
        This exact password hasn&apos;t appeared in any of the breach datasets{" "}
        <a
          href="https://haveibeenpwned.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal hover:underline"
        >
          HIBP
        </a>{" "}
        tracks.
      </>
    ),
    doesntMean:
      "That's a good sign, but not a guarantee — and it says nothing about how easily it could be guessed. A common word with a birthday attached could still be weak even if it's never leaked.",
    action:
      "No action required. If you'd like extra peace of mind, you can still generate a new one.",
  };
}

export default function HibpPage() {
  const moduleId = useModuleId();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  // Bumped on reset to force PasswordField to remount, which clears its
  // internal show/hide state along with everything else Reset already
  // clears. PasswordField deliberately doesn't expose that state to its
  // parent (see PasswordField.js) — this preserves the prior reset
  // behavior without re-lifting state the component owns on purpose.
  const [resetKey, setResetKey] = useState(0);
  // First 5 hex chars of the password's SHA-1 — shown live so the user can
  // see exactly what leaves the device before clicking Check. Display only:
  // it is deliberately never passed to saveActivity.
  const [prefix, setPrefix] = useState(null);
  // Guards against out-of-order sha1Hex resolves while typing fast: each new
  // keystroke bumps the id, so stale promises are ignored.
  const prefixRequestRef = useRef(0);

  function handlePasswordChange(e) {
    const value = e.target.value;
    setPassword(value);
    setResult(null);
    setError(null);

    const requestId = ++prefixRequestRef.current;
    setPrefix(null);
    if (!value) return;

    sha1Hex(value)
      .then((hash) => {
        if (prefixRequestRef.current === requestId) {
          setPrefix(hash.slice(0, 5));
        }
      })
      .catch(() => {
        if (prefixRequestRef.current === requestId) setPrefix(null);
      });
  }

  function resetForm() {
    prefixRequestRef.current += 1;
    setPrefix(null);
    setPassword("");
    setResult(null);
    setError(null);
    setResetKey((key) => key + 1);
  }

  async function handleCheck() {
    if (!password) return;
    setError(null);
    setResult(null);
    setIsChecking(true);

    try {
      const outcome = await checkPasswordBreach(password);
      setResult(outcome);

      // Outcome and timestamp only — never the password, never even a
      // hash of it, and not the breach count either (a count, combined
      // with other logged metadata, could narrow down which password
      // this was).
      saveActivity({
        moduleType: moduleId,
        summary: outcome.breached
          ? "Checked a password — found in a known breach"
          : "Checked a password — not found in known breaches",
        details: { breached: outcome.breached },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <ModulePage>

        <label className="block text-sm font-medium text-ink mb-1">
          Password to check
        </label>
        <div className="mb-1">
          <PasswordField
            key={resetKey}
            value={password}
            onChange={handlePasswordChange}
            onEnter={handleCheck}
            placeholder="Enter a password"
            ariaLabel="Password to check"
          />
        </div>
        <div className="mb-4 rounded-xl border border-slate/20 bg-surface px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="shrink-0 text-teal mt-0.5" />
            <div className="min-w-0 text-xs text-slate leading-relaxed">
              <p>
                Only a 5-character fragment of this password&apos;s hash is ever
                sent — never the password itself, and never the full hash.
              </p>
              {prefix ? (
                <div className="mt-2.5 divide-y divide-slate/10">
                  <div className="flex items-start justify-between gap-4 py-1.5">
                    <span className="shrink-0">SHA-1 prefix</span>
                    <span className="font-mono text-ink text-right break-all">
                      {prefix}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-1.5">
                    <span className="shrink-0">Endpoint</span>
                    <a
                      href={`https://api.pwnedpasswords.com/range/${prefix}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open the queried range URL for prefix ${prefix} in a new tab`}
                      className="font-mono text-teal hover:underline text-right break-all"
                    >
                      api.pwnedpasswords.com/range/{prefix}
                    </a>
                  </div>
                </div>
              ) : (
                <p className="mt-1">
                  Type a password to see the exact prefix a check would send.
                </p>
              )}
            </div>
          </div>
        </div>

        <AnalyseActions
          onAnalyse={handleCheck}
          canAnalyse={password && !isChecking}
          actionLabel="Check password"
          loading={isChecking}
          loadingLabel="Checking…"
          onReset={resetForm}
          showReset={password || result || error}
        />

        {error && (
          <div className="mt-4">
            <InlineError action={{ label: "Try again", onClick: handleCheck }}>
              {error}
            </InlineError>
            <p className="text-xs text-slate mt-1">
              Only a small, anonymized fragment of your password&apos;s hash is
              ever sent — this failure didn&apos;t expose anything more than
              that, whether it happened before or after the request went
              out.
            </p>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <ResultCard
              verdict={result.breached ? "mismatch" : "match"}
              headingLevel="h2"
              heading={
                result.breached
                  ? "Found in a known breach"
                  : "Not found in known breaches"
              }
              details={
                result.breached
                  ? [
                      {
                        label: "Times seen in breaches",
                        value: result.count.toLocaleString(),
                        primary: true,
                      },
                    ]
                  : []
              }
              explanation={getExplanation(result)}
            >
              <CompanionLinks
                links={[
                  {
                    href: "/modules/password-generator",
                    label: result.breached
                      ? "Generate a new password instead"
                      : "Generate an even stronger one",
                  },
                ]}
              />
            </ResultCard>
          </div>
        )}
    </ModulePage>
  );
}
