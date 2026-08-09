import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

// One shared instance for the whole app. Building it does the expensive
// dictionary/graph setup once at module load, rather than repeating that
// work on every keystroke — important given decision 4 (live analysis).
const zxcvbn = new ZxcvbnFactory({
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  translations: zxcvbnEnPackage.translations,
});

// Input beyond this length is truncated before reaching zxcvbn-ts.
// Matches Password Generator's own max length (128) — one consistent
// answer across the app for "how long can a password be here," rather
// than two arbitrary limits. Also bounds worst-case compute: zxcvbn-ts's
// pattern matching scales roughly quadratically with length on
// adversarial input (repeated dictionary words with l33t substitutions
// are the worst measured case), so shorter is meaningfully safer —
// measured at ~11s worst-case at 128 chars, vs. up to ~46s at 256.
export const MAX_PASSWORD_LENGTH = 128;

// zxcvbn-ts's four crack-time scenarios, in the order they should appear
// in the UI. "offlineSlowHashingXPerSecond" is treated as the headline
// scenario elsewhere (see the page's getExplanation) since it's the most
// realistic "the site did things reasonably" case; the rest are secondary
// and belong in the collapsible detail, not the headline.
export const SCENARIO_ORDER = [
  "offlineSlowHashingXPerSecond",
  "offlineFastHashingXPerSecond",
  "onlineNoThrottlingXPerSecond",
  "onlineThrottlingXPerHour",
];

const SCENARIO_LABELS = {
  offlineSlowHashingXPerSecond: "If the site hashed it properly (offline, slow hash)",
  offlineFastHashingXPerSecond: "If the site stored it poorly (offline, fast hash)",
  onlineNoThrottlingXPerSecond: "Online guessing, no rate limit",
  onlineThrottlingXPerHour: "Online guessing, rate-limited",
};

// A short (2-3 word) all-lowercase phrase like "hello world". The word-phrase
// note in the UI applies to these and not to four-word passphrases — the
// four-word shape is the canonical strong passphrase (XKCD 936) and doesn't
// deserve the "may overstate" grain of salt.
function isPlainWordPhrase(input) {
  const words = input.trim().split(" ");
  return (
    words.length >= 2 &&
    words.length <= 3 &&
    words.every((word) => /^[a-z]+$/.test(word))
  );
}

// The dictionary words zxcvbn actually matched, in order — surfaced so the
// result view can show *why* a password scored as it did.
function collectDictionaryWords(sequence) {
  const words = [];
  for (const match of sequence) {
    if (match.pattern === "dictionary" && match.matchedWord) {
      if (!words.some((entry) => entry.word === match.matchedWord)) {
        words.push({ word: match.matchedWord, rank: match.rank });
      }
    }
  }
  return words;
}

// Words ranked below this (rank 1 = most common) count as "common".
const COMMON_WORD_RANK = 1000;

// Runs zxcvbn-ts against a password and returns a shaped result for the
// UI. Synchronous — zxcvbn-ts's .check() does not return a promise, which
// is what makes running it in the Web Worker (`guessability.worker.js`)
// straightforward: the worker calls this and posts the shaped result back
// to the page.
//
// Nothing here is persisted by this function or anywhere upstream of it —
// per decision 5, this module logs no activity at all, not even a score.
export function analyzePassword(password) {
  if (!password) return null;

  const truncated = password.length > MAX_PASSWORD_LENGTH;
  const input = truncated ? password.slice(0, MAX_PASSWORD_LENGTH) : password;

  const result = zxcvbn.check(input);

  const dictionaryWords = collectDictionaryWords(result.sequence);
  // zxcvbn's search adds a growing-sequence floor (10000^(submatchCount - 1))
  // to any password that splits into several submatches, which can push a
  // short common phrase up to the "Good" band even though each word is
  // individually trivial. The score stays zxcvbn's own; this flag only lets
  // the page add context when that estimate is most likely to overstate.
  const wordPhraseNote =
    isPlainWordPhrase(input) &&
    dictionaryWords.length >= 1 &&
    dictionaryWords.every(({ rank }) => rank < COMMON_WORD_RANK);

  return {
    score: result.score, // 0-4, zxcvbn-ts's own scale
    truncated,
    crackTimes: SCENARIO_ORDER.map((key) => ({
      key,
      label: SCENARIO_LABELS[key],
      display: result.crackTimes[key].display,
    })),
    // Verbatim from zxcvbn-ts — see decision 7: this is already
    // plain-language, user-facing text, not raw technical output that
    // needs a translation layer the way File Integrity/HIBP needed.
    warning: result.feedback.warning || null,
    suggestions: result.feedback.suggestions || [],
    matchedWords: dictionaryWords.map(({ word }) => word),
    wordPhraseNote,
  };
}
