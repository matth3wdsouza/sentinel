import { secureRandomInt } from "./passwordGen";

// Built-in wordlists are plain .txt files in /public — one word per line,
// the same format a custom upload uses — rather than bundled JS arrays.
// Each is fetched on demand instead of imported directly, trading a brief
// load for the files staying inspectable/editable as plain data, not code.
// Same-origin (served by this app itself), so this is still fully local —
// no third-party request, unlike HIBP's k-anonymity lookup.
export const BUILT_IN_WORDLISTS = [
  {
    id: "eff-large",
    label: "EFF long list",
    description: "7,776 words (~12.9 bits/word) — the standard diceware reference.",
    url: "/wordlists/eff-large.txt",
  },
  {
    id: "bip39-english",
    label: "BIP-39 (English)",
    description:
      "2,048 words (11 bits/word) — the standard wordlist behind crypto-wallet seed phrases; every word has a unique 4-letter prefix.",
    url: "/wordlists/bip39-english.txt",
  },
];

export const DEFAULT_WORDLIST_ID = "eff-large";

export async function loadBuiltInWordlist(id) {
  const entry = BUILT_IN_WORDLISTS.find((w) => w.id === id);
  if (!entry) {
    throw new Error(`Unknown built-in wordlist: ${id}`);
  }
  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(
      `Couldn't load the ${entry.label} — check your connection and try again.`
    );
  }
  const text = await response.text();
  // Routed through the same parser a custom upload uses, so built-in lists
  // are held to the exact same "one word per line, deduped" contract —
  // not a special case.
  return parseWordlist(text).words;
}

export const MIN_WORD_COUNT = 3;
// 24 mirrors the upper end of BIP-39's 12–24-word mnemonic range — an
// existing, widely-used precedent for "how long a word-based secret
// reasonably gets", rather than an arbitrary round number.
export const MAX_WORD_COUNT = 24;
export const DEFAULT_WORD_COUNT = 6;
export const DEFAULT_SEPARATOR = " ";

// A handful of common separators, offered as presets rather than a free-text
// field — a free-text separator field invites accidentally typing something
// that looks like a password character and gives a false sense of extra
// entropy (separators are fixed/predictable to an attacker, so they add
// none). Kept as an explicit list for the same reason CHARSET_CLASSES in
// passwordGen.js is a fixed object rather than open text.
export const SEPARATOR_PRESETS = [
  { id: "space", label: "Space", value: " " },
  { id: "hyphen", label: "Hyphen", value: "-" },
  { id: "period", label: "Period", value: "." },
  { id: "none", label: "None", value: "" },
];

// Word-case transforms are purely cosmetic — applying the same rule to
// every word is deterministic, so (unlike the random word choice itself)
// it contributes zero additional entropy. This is called out explicitly
// in the UI rather than left implicit, since it's an easy thing to
// mistake for "extra strength" the way an uppercase letter would in a
// traditional password.
export const WORD_CASE_OPTIONS = [
  { id: "lower", label: "lowercase", transform: (w) => w.toLowerCase() },
  {
    id: "capitalize",
    label: "Capitalized",
    transform: (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  },
  { id: "upper", label: "UPPERCASE", transform: (w) => w.toUpperCase() },
];
export const DEFAULT_WORD_CASE = "lower";

function applyWordCase(word, wordCaseId) {
  const option = WORD_CASE_OPTIONS.find((o) => o.id === wordCaseId);
  return option ? option.transform(word) : word;
}

// Below this many unique words, a list can't produce a meaningful passphrase
// no matter how many words are strung together (log2(128) ≈ 7 bits/word —
// even a 10-word passphrase would land under 70 bits). Generation is blocked
// entirely rather than silently allowed, since a small enough list undermines
// the entire point of the tool without the user necessarily realizing it.
export const UNUSABLE_LIST_THRESHOLD = 128;

// Below this, the list is usable but far weaker per word than the EFF list
// (~12.9 bits/word) — worth a visible warning, not a hard block.
export const WEAK_LIST_THRESHOLD = 1024;

// Duplicate lines above this fraction of the file are flagged as likely
// evidence the upload wasn't the expected one-word-per-line format (e.g. a
// sentence-per-line file, or the same short list repeated).
export const HIGH_DUPLICATE_RATIO = 0.05;

/**
 * Parses raw uploaded text into a wordlist. One word per line; blank lines
 * are dropped; duplicate words (case-insensitive) are removed, since a
 * duplicate can never be distinguished from another copy of itself once
 * picked — it doesn't add any real options to the draw, so counting it
 * would overstate entropy. The original casing of the first occurrence is
 * kept.
 *
 * Returns: { words, rawCount, uniqueCount, duplicateCount, blankLinesDropped }
 */
export function parseWordlist(text) {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim());
  const blankLinesDropped = lines.filter((line) => line.length === 0).length;
  const nonBlank = lines.filter((line) => line.length > 0);

  const seen = new Set();
  const words = [];
  let duplicateCount = 0;

  for (const word of nonBlank) {
    const key = word.toLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    words.push(word);
  }

  return {
    words,
    rawCount: nonBlank.length,
    uniqueCount: words.length,
    duplicateCount,
    blankLinesDropped,
  };
}

/**
 * Validates a parsed wordlist and returns a structured verdict rather than
 * a single boolean, since a list can be simultaneously "usable" and
 * "worth warning about" (e.g. a small-but-not-empty list, or a list with
 * some duplicates but still plenty of unique words). `level` drives the
 * banner's visual severity; `issues` are the specific, plain-language
 * reasons behind it.
 *
 * Returns: { level: 'ok' | 'warning' | 'error', issues: string[] }
 */
export function validateWordlist({ uniqueCount, duplicateCount, rawCount }) {
  const issues = [];

  if (uniqueCount === 0) {
    return {
      level: "error",
      issues: [
        "This file has no usable words — check that it's a plain text file with one word per line.",
      ],
    };
  }

  let level = "ok";
  const bitsPerWord = Math.log2(uniqueCount);

  if (uniqueCount < UNUSABLE_LIST_THRESHOLD) {
    level = "error";
    issues.push(
      `Only ${uniqueCount.toLocaleString()} unique word${
        uniqueCount === 1 ? "" : "s"
      } (about ${bitsPerWord.toFixed(
        1
      )} bits of entropy per word). That's below the ${UNUSABLE_LIST_THRESHOLD.toLocaleString()}-word minimum — too small to produce a passphrase with meaningful security no matter how many words you string together. Please use a larger list.`
    );
  } else if (uniqueCount < WEAK_LIST_THRESHOLD) {
    level = "warning";
    issues.push(
      `Only ${uniqueCount.toLocaleString()} unique words (about ${bitsPerWord.toFixed(
        1
      )} bits of entropy per word) — below the ${WEAK_LIST_THRESHOLD.toLocaleString()} words we'd recommend for real security, and well under the EFF list's ~12.9 bits per word. You'll need noticeably more words per passphrase to reach the same total strength.`
    );
  }

  if (duplicateCount > 0) {
    const duplicateRatio = rawCount > 0 ? duplicateCount / rawCount : 0;
    if (duplicateRatio > HIGH_DUPLICATE_RATIO) {
      level = level === "error" ? "error" : "warning";
    }
    issues.push(
      `Found ${duplicateCount.toLocaleString()} duplicate line${
        duplicateCount === 1 ? "" : "s"
      } — duplicates are automatically removed before generating, so passphrases draw from ${uniqueCount.toLocaleString()} unique word${
        uniqueCount === 1 ? "" : "s"
      }. A heavily duplicated file can also be a sign it wasn't the one-word-per-line format expected here.`
    );
  }

  return { level, issues };
}

/** Exact entropy in bits contributed by a single word drawn uniformly at
 * random from a list of the given size. */
export function entropyPerWord(listSize) {
  return Math.log2(listSize);
}

/** Exact total entropy in bits for a passphrase of `wordCount` words, each
 * drawn independently (with replacement) from a list of `listSize` words.
 * Independent draws make this exactly additive — no inclusion-exclusion
 * needed here, unlike passwordGen.js's "guarantee one of each class" case,
 * since nothing here constrains which words can appear together. */
export function totalEntropy(listSize, wordCount) {
  return wordCount * entropyPerWord(listSize);
}

/**
 * Plain-language strength label for a given entropy value, with a verdict
 * key that maps directly onto ResultCard's VERDICT_CONFIG so the label and
 * the result card's color coding always agree.
 */
export function strengthLabel(entropyBits) {
  if (entropyBits < 40) {
    return { label: "Weak", verdict: "mismatch" };
  }
  if (entropyBits < 60) {
    return { label: "Reasonable", verdict: "fallback" };
  }
  if (entropyBits < 80) {
    return { label: "Strong", verdict: "match" };
  }
  return { label: "Very strong", verdict: "success" };
}

/**
 * Generates a passphrase by drawing `wordCount` words independently and
 * uniformly at random from `words`, using the same CSPRNG-backed,
 * rejection-sampled `secureRandomInt` passwordGen.js uses (no modulo bias).
 * `wordCase` is applied uniformly after the random draw — it changes how
 * the passphrase looks, not how it was chosen, so it's deliberately left
 * out of the entropy calculation below.
 * Returns the passphrase alongside its exact entropy — computed the same
 * way regardless of which wordlist or case option was used.
 */
export function generatePassphrase({
  words,
  wordCount,
  separator = DEFAULT_SEPARATOR,
  wordCase = DEFAULT_WORD_CASE,
}) {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error(
      "No words available to generate from — check the active wordlist."
    );
  }
  if (!Number.isInteger(wordCount) || wordCount < 1) {
    throw new Error("Word count must be a positive integer.");
  }

  const chosenWords = [];
  for (let i = 0; i < wordCount; i++) {
    const word = words[secureRandomInt(words.length)];
    chosenWords.push(applyWordCase(word, wordCase));
  }

  const listSize = words.length;
  const entropyBits = totalEntropy(listSize, wordCount);

  return {
    passphrase: chosenWords.join(separator),
    words: chosenWords,
    wordCount,
    listSize,
    separator,
    wordCase,
    entropyPerWord: entropyPerWord(listSize),
    entropyBits,
  };
}
