// Common Password Checker — local denial-list lookup against the NCSC's
// "Top 100,000 passwords" (derived from Have I Been Pwned breach data).
//
// The list ships with the app as a gzipped .txt (one password per line,
// most common first) and is loaded on demand from /wordlists — a
// same-origin fetch, so nothing ever leaves for a third party (unlike
// HIBP's k-anonymity lookup). Rank is the line's position (1 = most
// common). Matching is case-insensitive with surrounding whitespace
// trimmed first.
//
// Attribution: NCSC "Top 100,000 passwords", Open Government Licence v3.0.

const WORDLIST_URL = "/wordlists/common-passwords.txt.gz";

let cachedList = null;

// DecompressionStream isn't available in very old browsers — fail with a
// clear message rather than a confusing TypeError.
function hasDecompressionStream() {
  return typeof DecompressionStream !== "undefined";
}

/**
 * Parses the raw list text into a Map of lower-cased password → rank (the
 * line's 1-indexed position among non-blank lines). Blank lines are skipped
 * without shifting ranks. The first occurrence of a case-variant keeps the
 * most-common rank, matching the case-insensitive lookup semantics.
 */
export function parseCommonPasswordList(text) {
  const wordToRank = new Map();
  let rank = 0;
  for (const rawLine of String(text ?? "").split(/\r\n|\r|\n/)) {
    const word = rawLine.trim();
    if (word.length === 0) continue;
    rank += 1;
    const key = word.toLowerCase();
    if (!wordToRank.has(key)) wordToRank.set(key, rank);
  }
  return wordToRank;
}

/**
 * Case-insensitive membership test against a parsed list.
 * Returns { found, rank } — rank is 1-indexed and null when not found.
 */
export function matchCommonPassword(password, wordToRank) {
  const key = String(password ?? "").trim().toLowerCase();
  if (!key) return { found: false, rank: null };
  return {
    found: wordToRank.has(key),
    rank: wordToRank.get(key) ?? null,
  };
}

/**
 * Loads and decompresses the bundled wordlist, caching the parsed Map so
 * repeated checks (and repeated visits) don't refetch it. On failure the
 * cache is cleared so the caller can retry.
 */
export async function loadCommonPasswords() {
  if (cachedList) return cachedList;
  if (!hasDecompressionStream()) {
    throw new Error(
      "This browser doesn't support gzip decompression, so the common-password list can't be loaded. Try a more recent browser."
    );
  }

  let response;
  try {
    response = await fetch(WORDLIST_URL);
  } catch {
    throw new Error(
      "Couldn't load the common-password list. Check your connection and try again."
    );
  }
  if (!response.ok) {
    throw new Error(
      "The common-password list couldn't be loaded. Try again in a moment."
    );
  }

  const buffer = await response.arrayBuffer();
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();

  cachedList = parseCommonPasswordList(text);
  return cachedList;
}