// PIN & Pattern Analyser — pure numeric-pattern scoring logic.
//
// Scores a numeric PIN/passcode for how easy it is to guess by detecting the
// common "lazy" patterns real people use: repeats, ascending/descending
// sequences, repeating couplet pairs, dates, keypad walks, and the most
// commonly leaked PINs. This is the numeric sibling of Guessability, which is
// tuned for passwords — zxcvbn has no PIN heuristics.
//
// This is heuristic, evidence-not-verdicts: it flags patterns so a person can
// decide, it does not prove a PIN is compromised. Everything runs locally on
// the pasted digits — the PIN itself is never logged or transmitted.

import { DANGER, WARNING, INFO } from "@/lib/severity";

// Re-exported so the existing tests/consumers keep importing from here.
export { DANGER, WARNING, INFO };

export const MAX_PIN_LENGTH = 12;

// The most commonly leaked 4- and 6-digit PINs (from NCSC/HIBP-derived data).
// Most begin with 19xx/20xx, sequences, or repeats — each class is also caught
// by the shape detectors, but this set is worth calling out by name.
const COMMON_PINS = new Set([
  "0000", "000000", "0011", "0101", "0220", "0987", "1000", "1003", "1004",
  "1010", "1018", "1111", "111111", "1122", "112233", "1212", "121212",
  "1221", "1223", "1230", "123123", "1233", "1234", "12345", "123456",
  "12345678", "12344321",
]);

const COMMON_PINS_6PLUS = new Set([
  "123321", "131313", "13579", "159357", "2000", "2010", "2020", "2222",
  "2323", "2468", "246810", "2580", "2580852", "3333", "4444", "4545",
  "5555", "654321", "6666", "6969", "7777", "7890", "8686", "8888",
  "951753", "9876", "9999",
]);

// Keypad "walk" lines — the digits that lie along a straight line on the
// numeric keypad and are therefore trivially guessable. Handles 3-4 digits.
const KEYPAD_WALKS = new Set([
  "147", "258", "369", "159", "357", "123", "456", "789", "036", "741",
  "852", "963", "951", "753", "1470", "2580", "3690", "0123", "3210",
  "1236", "1478", "7896", "9632", "1590", "3570",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

// Normalise input: strip spaces, dashes, and dots so "1234 5678" works.
function normalize(raw) {
  return String(raw ?? "").replace(/[\s\-_.]/g, "");
}

function hasOnlyDigits(s) {
  return /^[0-9]+$/.test(s);
}

function uniqueDigitCount(s) {
  return new Set(s.split("")).size;
}

// True if the whole string is a single repeated digit (e.g. "1111").
function isSingleDigit(s) {
  return new Set(s.split("")).size === 1;
}

// Count the longest run of the same digit (e.g. "111234" → 3).
function maxRepeatRun(s) {
  let max = 0;
  let cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) cur += 1;
    else cur = 1;
    if (cur > max) max = cur;
  }
  return max;
}

// True if all adjacent digits step up or down one at a time in a *consistent*
// direction (all ascending or all descending), e.g. "1234", "654321", "456789".
// Alternating pairs like "1212" are not sequences — they fail the direction check.
function isFullSequence(s) {
  if (s.length < 3) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d !== 1) asc = false;
    if (d !== -1) desc = false;
  }
  return asc || desc;
}

// True if the digits cycle through a 2-digit repeating pair (e.g. "1212",
// "4545", "3333" handled elsewhere), including reversed/rotating pairs.
function isCouplet(s) {
  if (s.length < 4 || s.length % 2 !== 0) return false;
  const pair = s.slice(0, 2);
  if (pair[0] === pair[1]) return false; // repeated digit handled elsewhere
  for (let i = 0; i < s.length; i += 2) {
    if (s.slice(i, i + 2) !== pair) return false;
  }
  return true;
}

// Date-like detection: 19xx/20xx years, or MMDD/DDMM forms, or YYMMDD.
function looksLikeDate(s) {
  if (s.length === 4) {
    const yyyy = parseInt(s, 10);
    if ((s[0] === "1" && s[1] === "9" && yyyy >= 1900 && yyyy <= 1999) ||
        (s[0] === "2" && s[1] === "0" && yyyy >= 2000 && yyyy <= 2030)) {
      return true;
    }
    const mmdd = s[0] === "0" || s[0] === "1";
    const mm = parseInt(s.slice(0, 2), 10);
    const dd = parseInt(s.slice(2, 4), 10);
    if (mmdd && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return true;
    return false;
  }
  if (s.length === 6) {
    const yy = parseInt(s.slice(0, 2), 10);
    const mm = parseInt(s.slice(2, 4), 10);
    const dd = parseInt(s.slice(4, 6), 10);
    if (yy >= 0 && yy <= 99 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return true;
    }
  }
  return false;
}

// ── Pattern detection ────────────────────────────────────────────────────────

function detectPatterns(digits) {
  const patterns = [];

  if (COMMON_PINS.has(digits)) {
    patterns.push({
      id: "common-list",
      tier: DANGER,
      label: "On the most common PIN list",
      detail:
        "This exact PIN ranks among the most commonly leaked codes. It will be one of the first a guesser tries.",
    });
  } else if (COMMON_PINS_6PLUS.has(digits) || KEYPAD_WALKS.has(digits)) {
    patterns.push({
      id: "common-list",
      tier: WARNING,
      label: "A well-known PIN",
      detail:
        "This PIN follows a pattern that shows up often in leaked password data — easy for a guesser to reach.",
    });
  }

  if (isSingleDigit(digits)) {
    patterns.push({
      id: "repeat",
      tier: DANGER,
      label: "Single repeated digit",
      detail: `All ${digits.length} digits are the same. There are only 10 of these in total — trivial to guess.`,
    });
  } else if (maxRepeatRun(digits) >= 3) {
    patterns.push({
      id: "repeat",
      tier: WARNING,
      label: "Repeated digits",
      detail:
        "A digit is repeated back-to-back several times. Repeats like this appear far more often in real PINs than random chance alone would produce.",
    });
  }

  if (isFullSequence(digits)) {
    patterns.push({
      id: "sequence",
      tier: WARNING,
      label: "Runs in a straight sequence",
      detail: `Digits step up or down one at a time (${digits}). Sequences like 1234 / 9876 are guesser favourites.`,
    });
  }

  if (isCouplet(digits)) {
    patterns.push({
      id: "couplet",
      tier: WARNING,
      label: "Repeating pair",
      detail: `The digits cycle through the same two-digit pair (${digits.slice(0, 2)}). Alternating codes like 1212 or 4545 are very common.`,
    });
  }

  if (looksLikeDate(digits)) {
    patterns.push({
      id: "date",
      tier: WARNING,
      label: "Looks like a date",
      detail:
        "The digits match a year, month/day, or date. Birthdays, anniversaries, and years are among the most predictable PINs — and often findable from photo IDs or public profiles.",
    });
  }

  const uniques = uniqueDigitCount(digits);
  // Info-level guidance only when the PIN is otherwise pattern-free.
  if (patterns.length === 0) {
    patterns.push({
      id: "entropy",
      tier: INFO,
      label: "Space of possible PINs",
      detail:
        `A ${digits.length}-digit numeric PIN has ${Math.pow(10, digits.length).toLocaleString()} possibilities, but only ${uniques} distinct digit${uniques === 1 ? "" : "s"} are used. Fewer digits makes it easier to guess.`,
    });
  }

  return patterns;
}

function computeVerdict(patterns) {
  if (patterns.some((p) => p.tier === DANGER)) return "weak";
  if (patterns.some((p) => p.tier === WARNING)) return "fair";
  return "strong";
}

// ── Public API ───────────────────────────────────────────────────────────────

// Analysed result:
//   verdict     — "weak" | "fair" | "strong"
//   patterns    — array of { id, tier, label, detail }
//   length      — number of digits
//   uniqueDigits — count of distinct digits
//   isNumeric   — false when the input contains non-digit characters
// Returns null for empty/blank input.
export function analyzePIN(raw) {
  const normalized = normalize(raw);
  if (!normalized) return null;

  if (!hasOnlyDigits(normalized)) {
    return {
      verdict: null,
      patterns: [],
      length: normalized.length,
      uniqueDigits: uniqueDigitCount(normalized),
      isNumeric: false,
    };
  }

  const digits = normalized.slice(0, MAX_PIN_LENGTH);
  const patterns = detectPatterns(digits);
  const verdict = computeVerdict(patterns);

  return {
    verdict,
    patterns,
    length: digits.length,
    uniqueDigits: uniqueDigitCount(digits),
    isNumeric: true,
  };
}
