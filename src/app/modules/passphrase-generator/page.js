"use client";

import { useState, useEffect } from "react";
import {
  BUILT_IN_WORDLISTS,
  DEFAULT_WORDLIST_ID,
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
  DEFAULT_WORD_COUNT,
  DEFAULT_SEPARATOR,
  SEPARATOR_PRESETS,
  WORD_CASE_OPTIONS,
  DEFAULT_WORD_CASE,
  UNUSABLE_LIST_THRESHOLD,
  WEAK_LIST_THRESHOLD,
  loadBuiltInWordlist,
  parseWordlist,
  validateWordlist,
  generatePassphrase,
  strengthLabel,
} from "@/lib/wordlist";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { usePreference } from "@/lib/usePreference";
import { deletePreference } from "@/lib/db";
import OptionRow from "@/components/OptionRow";
import FileInput from "@/components/FileInput";
import GeneratorResultCard from "@/components/GeneratorResultCard";
import ModulePage from "@/components/ModulePage";
import InlineError from "@/components/InlineError";
import CompanionLinks from "@/components/CompanionLinks";
import { companionLinksFor } from "@/lib/companionLinks";
import { Button } from "@/components/Button";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import {
  OctagonAlert,
  AlertTriangle,
} from "lucide-react";

const BANNER_CONFIG = {
  error: {
    icon: OctagonAlert,
    className: "border-mismatch/40 bg-mismatch-light text-mismatch-chip",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-fallback/40 bg-fallback-light text-fallback",
  },
};

const SELECT_CLASSNAME =
  "w-full border border-slate/30 rounded-lg px-3 py-1.5 text-sm bg-surface focus:border-teal transition";

const PREF_KEY = "passphrase-generator.settings";

const DEFAULT_SETTINGS = {
  selectedListId: DEFAULT_WORDLIST_ID,
  wordCount: DEFAULT_WORD_COUNT,
  separator: DEFAULT_SEPARATOR,
  wordCase: DEFAULT_WORD_CASE,
};

function WordlistWarningBanner({ validation }) {
  if (!validation || validation.issues.length === 0) return null;
  const config = BANNER_CONFIG[validation.level];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border px-4 py-3 mb-4 ${config.className}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          {validation.issues.map((issue, i) => (
            <p key={i} className="text-sm">{issue}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function getExplanation(result) {
  const { label } = strengthLabel(result.entropyBits);
  return {
    means: `This passphrase has ${result.entropyBits.toFixed(
      1
    )} bits of entropy — each of its ${result.wordCount} words was chosen independently from a list of ${result.listSize.toLocaleString()} (${result.entropyPerWord.toFixed(
      2
    )} bits/word). Overall strength: ${label.toLowerCase()}.`,
    doesntMean:
      "This measures how randomly the passphrase was generated — it doesn't tell you whether it's ever appeared in a breach, or how memorable it is for you. Those are different questions, answered by other tools.",
    action:
      "Copy it now and store it in a password manager — it isn't saved anywhere by this tool, and won't be shown again.",
  };
}

export default function PassphraseGeneratorPage() {
  const moduleId = useModuleId();
  // All four persisted settings as a single object — loaded and written
  // atomically so there's no partial-state flash on mount.
  const [settings, setSettings] = usePreference(PREF_KEY, DEFAULT_SETTINGS, {
    debounceMs: 300,
  });

  // Convenience aliases so the rest of the component reads cleanly.
  const selectedListId = settings.selectedListId ?? DEFAULT_WORDLIST_ID;
  const wordCount = settings.wordCount ?? DEFAULT_WORD_COUNT;
  const separator = settings.separator ?? DEFAULT_SEPARATOR;
  const wordCase = settings.wordCase ?? DEFAULT_WORD_CASE;

  // Helper: merge a partial update into settings (keeps other fields intact).
  function updateSettings(patch) {
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }));
  }

  const [builtInWords, setBuiltInWords] = useState(null);
  const [builtInError, setBuiltInError] = useState(null);
  const [builtInLoadAttempt, setBuiltInLoadAttempt] = useState(0);

  const [customFile, setCustomFile] = useState(null);
  const [customParsed, setCustomParsed] = useState(null);
  const [customValidation, setCustomValidation] = useState(null);
  const [uploadVersion, setUploadVersion] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, copy] = useCopyToClipboard();
  const [showHelp, setShowHelp] = useState(false);

  const usingCustom = selectedListId === "custom";
  const customBlocked = usingCustom && customValidation?.level === "error";
  const activeWords = usingCustom
    ? customBlocked ? null : customParsed?.words ?? null
    : builtInWords;

  useEffect(() => {
    if (selectedListId === "custom") return;
    let cancelled = false;

    loadBuiltInWordlist(selectedListId)
      .then((words) => { if (!cancelled) setBuiltInWords(words); })
      .catch((err) => {
        if (!cancelled)
          setBuiltInError(err.message || "Couldn't load that wordlist.");
      });

    return () => { cancelled = true; };
  }, [selectedListId, builtInLoadAttempt]);

  const generationSignature = `${selectedListId}|${wordCount}|${separator}|${wordCase}|${uploadVersion}|${
    activeWords ? "ready" : "pending"
  }`;
  const [signatureForResult, setSignatureForResult] = useState(null);

  if (generationSignature !== signatureForResult) {
    setSignatureForResult(generationSignature);
    if (!activeWords) {
      setResult(null);
      setError(null);
    } else {
      try {
        setResult(generatePassphrase({ words: activeWords, wordCount, separator, wordCase }));
        setError(null);
      } catch (err) {
        setResult(null);
        setError(err.message);
      }
    }
  }

  const placeholderMessage = activeWords
    ? null
    : usingCustom
    ? customBlocked
      ? "Passphrase generation is paused until the wordlist issue above is resolved."
      : "Upload a wordlist to generate a passphrase."
    : builtInError
    ? null
    : "Loading the wordlist…";

  function selectWordlist(id) {
    updateSettings({ selectedListId: id });
    if (id !== "custom") {
      setBuiltInWords(null);
      setBuiltInError(null);
    }
  }

  function retryBuiltInLoad() {
    setBuiltInWords(null);
    setBuiltInError(null);
    setBuiltInLoadAttempt((n) => n + 1);
  }

  async function handleFileChange(file) {
    setCustomFile(file);
    setCustomParsed(null);
    setCustomValidation(null);
    setUploadError(null);

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseWordlist(text);
      setCustomParsed(parsed);
      setCustomValidation(validateWordlist(parsed));
      setUploadVersion((v) => v + 1);
    } catch {
      setUploadError(
        "Couldn't read that file — make sure it's a plain text file with one word per line."
      );
    }
  }

  function regenerate() {
    if (!activeWords) return;
    try {
      setResult(generatePassphrase({ words: activeWords, wordCount, separator, wordCase }));
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  }

  async function resetForm() {
    setSettings(DEFAULT_SETTINGS);
    setCustomFile(null);
    setCustomParsed(null);
    setCustomValidation(null);
    setUploadError(null);
    setError(null);
    await deletePreference(PREF_KEY).catch(() => {});
  }

  function handleCopy() {
    if (!result) return;
    copy(result.passphrase);
    saveActivity({
      moduleType: moduleId,
      summary: `Copied a ${result.wordCount}-word generated passphrase`,
      details: {
        wordCount: result.wordCount,
        listSize: result.listSize,
        separator: result.separator,
        wordCase: result.wordCase,
        entropyPerWord: result.entropyPerWord,
        entropyBits: result.entropyBits,
        wordlistId: selectedListId,
      },
    });
  }

  const isDefaults =
    selectedListId === DEFAULT_WORDLIST_ID &&
    wordCount === DEFAULT_WORD_COUNT &&
    separator === DEFAULT_SEPARATOR &&
    wordCase === DEFAULT_WORD_CASE &&
    !customFile;

  const { label: strength, verdict } = result
    ? strengthLabel(result.entropyBits)
    : { label: null, verdict: "neutral" };

  const selectedBuiltIn = BUILT_IN_WORDLISTS.find((w) => w.id === selectedListId);

  return (
    <ModulePage>

        <div className="rounded-xl bg-surface shadow-card p-5 mb-5">
          <p className="text-sm font-medium mb-2">Wordlist</p>
          <select
            value={selectedListId}
            onChange={(e) => selectWordlist(e.target.value)}
            aria-label="Wordlist"
            className={SELECT_CLASSNAME}
          >
            {BUILT_IN_WORDLISTS.map((wl) => (
              <option key={wl.id} value={wl.id}>{wl.label}</option>
            ))}
            <option value="custom">Upload a custom wordlist…</option>
          </select>

          {!usingCustom && (
            <p className="text-xs text-slate mt-1.5">
              {selectedBuiltIn?.description}
              {builtInWords && ` Loaded: ${builtInWords.length.toLocaleString()} words.`}
            </p>
          )}

          {!usingCustom && builtInError && (
            <InlineError
              className="mt-2"
              action={{ label: "Try again", onClick: retryBuiltInLoad }}
            >
              {builtInError}
            </InlineError>
          )}

          {usingCustom && (
            <div className="mt-3">
              <FileInput
                label="Custom wordlist (.txt, one word per line)"
                file={customFile}
                onChange={handleFileChange}
                accept=".txt,text/plain"
              />
              <p className="text-xs text-slate mt-1.5">
                Useful for generating passphrases in a language other than
                English — upload any plain text file with one word per line.
                Needs at least {UNUSABLE_LIST_THRESHOLD.toLocaleString()}{" "}
                unique words to generate anything at all; for real security
                you&apos;ll want closer to {WEAK_LIST_THRESHOLD.toLocaleString()}{" "}
                or more (the{" "}
                <a
                  href="https://www.eff.org/dice"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal hover:underline"
                >
                  EFF
                </a>{" "}
                long list above has 7,776).
              </p>

              {uploadError && (
                <InlineError className="mt-2">{uploadError}</InlineError>
              )}

              {customParsed && (
                <div className="mt-3">
                  <WordlistWarningBanner validation={customValidation} />
                  {!customBlocked && (
                    <p className="text-xs text-slate">
                      {customParsed.uniqueCount.toLocaleString()} unique word
                      {customParsed.uniqueCount === 1 ? "" : "s"} loaded.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface shadow-card overflow-hidden">
          <GeneratorResultCard
            result={result}
            placeholderText={error ? error : placeholderMessage ?? "Generating…"}
            renderOutput={(r) =>
              r.words.map((word, i) => (
                <span key={i}>
                  <span className={i % 2 === 0 ? "text-ink" : "text-teal"}>{word}</span>
                  {i < r.words.length - 1 && (
                    <span className="text-slate">{r.separator}</span>
                  )}
                </span>
              ))
            }
            copyLabel="Copy passphrase"
            regenerateLabel="New passphrase"
            copied={copied}
            onCopy={handleCopy}
            onRegenerate={regenerate}
            stats={
              result
                ? [
                    `${result.entropyPerWord.toFixed(2)} bits/word`,
                    `${result.entropyBits.toFixed(1)} bits total`,
                  ]
                : []
            }
            chip={result ? { label: strength, verdict } : undefined}
            showHelp={showHelp}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            explanation={result ? getExplanation(result) : null}
          />

          <div className="border-t border-slate/20 p-5 space-y-4">
            <div>
              <label className="flex items-center justify-between text-sm font-medium mb-2">
                <span>Number of words</span>
                <span className="text-slate">{wordCount} words</span>
              </label>
              <input
                type="range"
                min={MIN_WORD_COUNT}
                max={MAX_WORD_COUNT}
                value={wordCount}
                onChange={(e) => updateSettings({ wordCount: Number(e.target.value) })}
                aria-label="Number of words"
                className="w-full accent-teal"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Separator</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {SEPARATOR_PRESETS.map((preset) => (
                  <OptionRow
                    key={preset.id}
                    type="radio"
                    name="separator"
                    checked={separator === preset.value}
                    onChange={() => updateSettings({ separator: preset.value })}
                  >
                    {preset.label}
                  </OptionRow>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Word case</label>
              <select
                value={wordCase}
                onChange={(e) => updateSettings({ wordCase: e.target.value })}
                aria-label="Word case"
                className={SELECT_CLASSNAME}
              >
                {WORD_CASE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate mt-1.5">
                Cosmetic only — applied the same way to every word, so it
                doesn&apos;t add entropy or make the passphrase harder to guess.
              </p>
            </div>
          </div>
        </div>

        <CompanionLinks links={companionLinksFor("/modules/passphrase-generator")} />

        {!isDefaults && (
          <Button variant="ghost" resetIcon onClick={resetForm} className="mt-3">
            Reset to defaults
          </Button>
        )}
    </ModulePage>
  );
}
