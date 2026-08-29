"use client";

import { useState, useEffect } from "react";
import { generatePassword, DEFAULT_OPTIONS } from "@/lib/passwordGen";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { usePreference } from "@/lib/usePreference";
import { deletePreference } from "@/lib/db";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import OptionRow from "@/components/OptionRow";
import GeneratorResultCard from "@/components/GeneratorResultCard";
import ModulePage from "@/components/ModulePage";
import Disclosure from "@/components/Disclosure";
import { Button } from "@/components/Button";
import { KeyRound } from "lucide-react";

const CLASS_LABELS = {
  lowercase: "Lowercase",
  uppercase: "Uppercase",
  digits: "Digits",
  symbols: "Symbols",
};

const CLASS_EXAMPLES = {
  lowercase: "abc",
  uppercase: "ABC",
  digits: "123",
  symbols: "!@#",
};

function isDefaultOptions(options) {
  return Object.keys(DEFAULT_OPTIONS).every(
    (key) => options[key] === DEFAULT_OPTIONS[key]
  );
}

function charClassName(ch) {
  if (/[0-9]/.test(ch)) return "text-fallback";
  if (/[a-zA-Z]/.test(ch)) return "text-ink";
  return "text-teal";
}

function getExplanation(result) {
  const naiveEntropy = result.length * Math.log2(result.charsetSize);
  return {
    means: result.guaranteeOneOfEach
      ? `This password has exactly ${result.entropyBits.toFixed(
          1
        )} bits of entropy. That's slightly lower than an unconstrained ${
          result.charsetSize
        }-character random draw of this length (${naiveEntropy.toFixed(
          1
        )} bits), because this password is guaranteed to include at least one character from each selected type.`
      : `This password has exactly ${result.entropyBits.toFixed(
          1
        )} bits of entropy — every character was chosen independently at random from a set of ${
          result.charsetSize
        } possible characters.`,
    doesntMean:
      "This number describes how randomly the password was generated — it doesn't tell you whether this exact password has ever appeared in a known data breach, or how easily a pattern-matching guesser could crack a password like it. Those are different questions, answered by other tools.",
    action:
      "Copy it now and store it in a password manager — it isn't saved anywhere by this tool, and it won't be shown again.",
  };
}

const PREF_KEY = "password-generator.options";

export default function PasswordGeneratorPage() {
  const moduleId = useModuleId();
  // `options` is the single source of truth for generator settings. It's
  // backed by usePreference so it loads from IndexedDB on mount and writes
  // back on every change — no separate mirror state needed.
  const [options, setOptions] = usePreference(PREF_KEY, DEFAULT_OPTIONS, {
    debounceMs: 300,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, copy] = useCopyToClipboard();
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Regenerate whenever options change. options starts at DEFAULT_OPTIONS on
  // mount, so this also produces the first result. useEffect avoids the
  // render-phase setState anti-pattern; the extra render cycle is imperceptible
  // here.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setResult(generatePassword(options));
        setError(null);
      } catch (err) {
        setResult(null);
        setError(err.message);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [options]);

  function updateOption(key, value) {
    setOptions((prev) => ({ ...DEFAULT_OPTIONS, ...prev, [key]: value }));
  }

  function toggleClass(name) {
    updateOption(name, !options[name]);
  }

  async function resetForm() {
    setOptions(DEFAULT_OPTIONS);
    setShowAdvanced(false);
    setError(null);
    await deletePreference(PREF_KEY).catch(() => {});
  }

  function regenerate() {
    try {
      setResult(generatePassword(options));
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  }

  function handleCopy() {
    if (!result) return;
    copy(result.password);
    saveActivity({
      moduleType: moduleId,
      summary: `Copied a ${result.length}-character generated password`,
      details: {
        length: result.length,
        charsetSize: result.charsetSize,
        classesUsed: result.classesUsed,
        guaranteeOneOfEach: result.guaranteeOneOfEach,
        entropyBits: result.entropyBits,
      },
    });
  }

  return (
    <ModulePage
      icon={KeyRound}
      title="Password Generator"
      description="Generate strong, random passwords with exact entropy calculations."
    >

        <div className="rounded-xl bg-surface shadow-card overflow-hidden">
          <GeneratorResultCard
            result={result}
            placeholderText={error ? error : "Generating…"}
            renderOutput={(r) =>
              r.password.split("").map((ch, i) => (
                <span key={i} className={charClassName(ch)}>
                  {ch}
                </span>
              ))
            }
            copyLabel="Copy password"
            regenerateLabel="New password"
            copied={copied}
            onCopy={handleCopy}
            onRegenerate={regenerate}
            stats={result ? [`${result.entropyBits.toFixed(1)} bits of entropy`] : []}
            showHelp={showHelp}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            explanation={result ? getExplanation(result) : null}
          />

          <div className="border-t border-slate/20 p-5">
            <div className="mb-4">
              <label className="flex items-center justify-between text-sm font-medium mb-2">
                <span>Length</span>
                <span className="text-slate">{options.length} characters</span>
              </label>
              <input
                type="range"
                min={8}
                max={128}
                value={options.length}
                onChange={(e) => updateOption("length", Number(e.target.value))}
                aria-label="Length"
                className="w-full accent-teal"
              />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4">
              {Object.keys(CLASS_LABELS).map((name) => (
                <OptionRow
                  key={name}
                  checked={options[name]}
                  onChange={() => toggleClass(name)}
                  hint={CLASS_EXAMPLES[name]}
                >
                  {CLASS_LABELS[name]}
                </OptionRow>
              ))}
            </div>

            <Disclosure
              label="Advanced options"
              open={showAdvanced}
              onToggle={() => setShowAdvanced((prev) => !prev)}
              buttonClassName="flex items-center gap-1 text-sm text-teal"
              contentClassName="mt-3 pl-1 space-y-3"
            >
              <OptionRow
                checked={options.excludeAmbiguous}
                onChange={(e) => updateOption("excludeAmbiguous", e.target.checked)}
              >
                Exclude ambiguous characters (0/O, 1/l/I)
              </OptionRow>
              <p className="text-xs text-slate -mt-2">
                Improves readability slightly at the cost of a smaller character
                set — lowers entropy a little.
              </p>

              <OptionRow
                checked={options.guaranteeOneOfEach}
                onChange={(e) => updateOption("guaranteeOneOfEach", e.target.checked)}
              >
                Guarantee at least one of each selected character type
              </OptionRow>
              <p className="text-xs text-slate -mt-2">
                Some sites require this. It constrains the possible outputs, so
                entropy is calculated slightly lower to stay exact.
              </p>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Custom characters to exclude
                </label>
                <input
                  type="text"
                  value={options.customExclusions}
                  onChange={(e) => updateOption("customExclusions", e.target.value)}
                  placeholder="e.g. { } ` ~"
                  aria-label="Custom characters to exclude"
                  className="w-full border border-slate/30 rounded-lg px-3 py-1.5 text-sm font-mono bg-surface focus:border-teal transition"
                />
              </div>
            </Disclosure>
          </div>
        </div>

        {(!isDefaultOptions(options) || error) && (
          <Button variant="ghost" resetIcon onClick={resetForm} className="mt-3">
            Reset to defaults
          </Button>
        )}
    </ModulePage>
  );
}
