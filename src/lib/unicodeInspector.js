// Hidden Unicode Inspector — pure string scanning logic.
//
// Scans text for invisible or deceptive Unicode characters and classifies
// them into categories with a severity: bidi controls (danger), zero-width
// characters, soft hyphens, control characters, and homoglyphs (warning),
// combining marks and variation selectors (info). Everything runs locally
// on the pasted string — no content is ever logged or transmitted.

import { DANGER, WARNING, INFO } from "@/lib/severity";

// Re-exported so the existing tests/consumers keep importing from here.
export { DANGER, WARNING, INFO };

const BIDI_CODE_POINTS = new Set([
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

const ZERO_WIDTH_CODE_POINTS = new Set([
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0x2061, 0xfeff, 0x3000,
]);

const SOFT_HYPHEN = 0x00ad;

function isControlCodePoint(cp) {
  const basic = cp < 0x20 || (cp >= 0x7f && cp <= 0x9f);
  // Allow legitimate whitespace (tab, LF, CR) which are technically C0 controls.
  return basic && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d;
}

function isCombiningCodePoint(cp) {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x0483 && cp <= 0x0489) ||
    (cp >= 0x0591 && cp <= 0x05bd) ||
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  );
}

function isVariationSelector(cp) {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

// Trimmed confusable table — the characters rendered (nearly) identically to
// Latin letters in most fonts. A small curated set instead of the full TR39
// dataset keeps the bundle tiny while covering every common homograph.
const HOMOGLYPHS = new Map([
  [0x0131, { ascii: "i", alphabet: "Latin" }],
  [0x0430, { ascii: "a", alphabet: "Cyrillic" }],
  [0x0432, { ascii: "B", alphabet: "Cyrillic" }],
  [0x0435, { ascii: "e", alphabet: "Cyrillic" }],
  [0x043a, { ascii: "K", alphabet: "Cyrillic" }],
  [0x043c, { ascii: "M", alphabet: "Cyrillic" }],
  [0x043d, { ascii: "H", alphabet: "Cyrillic" }],
  [0x043e, { ascii: "o", alphabet: "Cyrillic" }],
  [0x0440, { ascii: "p", alphabet: "Cyrillic" }],
  [0x0441, { ascii: "c", alphabet: "Cyrillic" }],
  [0x0442, { ascii: "T", alphabet: "Cyrillic" }],
  [0x0443, { ascii: "y", alphabet: "Cyrillic" }],
  [0x0445, { ascii: "x", alphabet: "Cyrillic" }],
  [0x03b1, { ascii: "a", alphabet: "Greek" }],
  [0x03b5, { ascii: "e", alphabet: "Greek" }],
  [0x03b7, { ascii: "n", alphabet: "Greek" }],
  [0x03b9, { ascii: "i", alphabet: "Greek" }],
  [0x03ba, { ascii: "k", alphabet: "Greek" }],
  [0x03bd, { ascii: "v", alphabet: "Greek" }],
  [0x03bf, { ascii: "o", alphabet: "Greek" }],
  [0x03c1, { ascii: "p", alphabet: "Greek" }],
  [0x03c5, { ascii: "y", alphabet: "Greek" }],
  [0xff0e, { ascii: ".", alphabet: "Fullwidth" }],
]);

export const CATEGORY_CONFIG = {
  bidi: { label: "Bidi control", severity: DANGER },
  zeroWidth: { label: "Zero-width", severity: WARNING },
  softHyphen: { label: "Soft hyphen", severity: WARNING },
  control: { label: "Control character", severity: WARNING },
  homoglyph: { label: "Homoglyph", severity: WARNING },
  combining: { label: "Combining mark", severity: INFO },
  variation: { label: "Variation selector", severity: INFO },
  other: { label: "Notable character", severity: INFO },
};

// Curated Unicode names for every code point this tool flags with
// danger/warning severity (and a few notable info ones).
const CHARS = {
  0x202a: { name: "LEFT-TO-RIGHT EMBEDDING" },
  0x202b: { name: "RIGHT-TO-LEFT EMBEDDING" },
  0x202c: { name: "POP DIRECTIONAL FORMATTING" },
  0x202d: { name: "LEFT-TO-RIGHT OVERRIDE" },
  0x202e: { name: "RIGHT-TO-LEFT OVERRIDE" },
  0x2066: { name: "LEFT-TO-RIGHT ISOLATE" },
  0x2067: { name: "RIGHT-TO-LEFT ISOLATE" },
  0x2068: { name: "FIRST STRONG ISOLATE" },
  0x2069: { name: "POP DIRECTIONAL ISOLATE" },
  0x200b: { name: "ZERO WIDTH SPACE" },
  0x200c: { name: "ZERO WIDTH NON-JOINER" },
  0x200d: { name: "ZERO WIDTH JOINER" },
  0x200e: { name: "LEFT-TO-RIGHT MARK" },
  0x200f: { name: "RIGHT-TO-LEFT MARK" },
  0x2060: { name: "WORD JOINER" },
  0x2061: { name: "FUNCTION APPLICATION" },
  0xfeff: { name: "ZERO WIDTH NO-BREAK SPACE (BOM)" },
  0x3000: { name: "IDEOGRAPHIC SPACE" },
  0x00ad: { name: "SOFT HYPHEN" },
  0xfffd: { name: "REPLACEMENT CHARACTER" },
  0x0430: { name: "CYRILLIC SMALL LETTER A" },
  0x0432: { name: "CYRILLIC SMALL LETTER VE" },
  0x0435: { name: "CYRILLIC SMALL LETTER IE" },
  0x043a: { name: "CYRILLIC SMALL LETTER KA" },
  0x043c: { name: "CYRILLIC SMALL LETTER EM" },
  0x043d: { name: "CYRILLIC SMALL LETTER EN" },
  0x043e: { name: "CYRILLIC SMALL LETTER O" },
  0x0440: { name: "CYRILLIC SMALL LETTER ER" },
  0x0441: { name: "CYRILLIC SMALL LETTER ES" },
  0x0442: { name: "CYRILLIC SMALL LETTER TE" },
  0x0443: { name: "CYRILLIC SMALL LETTER U" },
  0x0445: { name: "CYRILLIC SMALL LETTER HA" },
  0x03b1: { name: "GREEK SMALL LETTER ALPHA" },
  0x03b5: { name: "GREEK SMALL LETTER EPSILON" },
  0x03b7: { name: "GREEK SMALL LETTER ETA" },
  0x03b9: { name: "GREEK SMALL LETTER IOTA" },
  0x03ba: { name: "GREEK SMALL LETTER KAPPA" },
  0x03bd: { name: "GREEK SMALL LETTER NU" },
  0x03bf: { name: "GREEK SMALL LETTER OMICRON" },
  0x03c1: { name: "GREEK SMALL LETTER RHO" },
  0x03c5: { name: "GREEK SMALL LETTER UPSILON" },
  0x0131: { name: "LATIN SMALL LETTER DOTLESS I" },
  0xff0e: { name: "FULLWIDTH FULL STOP" },
};

// Per-code point explanation overrides for the most important cases.
const SPECIFIC_EXPLANATIONS = {
  0x202e:
    "The RIGHT-TO-LEFT OVERRIDE is the most abused bidi control: it forces following text to render right-to-left even when written in a left-to-right script. Lines can be visually reordered while the underlying characters stay identical — the classic display-spoofing attack.",
  0x202c:
    "POP DIRECTIONAL FORMATTING terminates an active bidi override/embedding. Its presence implies part of this text was reordering — worth checking what it was guarding.",
  0xfeff:
    "ZERO WIDTH NO-BREAK SPACE, best known as the byte order mark (BOM). Legitimate at the start of UTF-16 files, but inside arbitrary text it's an invisible character that silently breaks exact string matching.",
  0x3000:
    "IDEOGRAPHIC SPACE is a full-width CJK space. It renders as a visible-ish gap that is NOT a normal ASCII space — copying text with one of these breaks comparisons and URL handling.",
};

const CATEGORY_EXPLANATION = {
  bidi:
    "Bidirectional controls force the rendering direction of following text regardless of the real script. They can visibly rearrange a line — the mechanism behind display-spoofing attacks.",
  zeroWidth:
    "An invisible character. It renders no glyph yet still occupies the string, so it can hide data, break comparisons, or be smuggled into identifiers, passwords, and URLs.",
  softHyphen:
    "A SOFT HYPHEN is invisible unless a line break happens exactly there, where it shows as a normal hyphen. It can change how a word renders or hide extra characters from view.",
  control:
    "A C0/C1 control character. These can inject formatting or carriage returns into text and should not appear in ordinary prose, passwords, or code.",
  homoglyph:
    "A look-alike character: visually identical or near-identical to a different character in another script. Used in homograph attacks to make hostile names and URLs appear legitimate.",
  combining:
    "A combining mark attaches to the preceding character (typically to form accented letters). Usually legitimate — flagged so you can see exactly what's in your text.",
  variation:
    "A variation selector tweaks how the preceding emoji or glyph renders. Legitimate, but easy to miss when scanning text by eye.",
  other:
    "A notable character, usually a replacement character left behind by lossy copy/paste conversions.",
};

function classify(cp) {
  if (BIDI_CODE_POINTS.has(cp)) return { category: "bidi" };
  if (ZERO_WIDTH_CODE_POINTS.has(cp)) return { category: "zeroWidth" };
  if (cp === SOFT_HYPHEN) return { category: "softHyphen" };
  if (isControlCodePoint(cp)) return { category: "control" };
  if (HOMOGLYPHS.has(cp)) {
    const { ascii, alphabet } = HOMOGLYPHS.get(cp);
    return { category: "homoglyph", ascii, alphabet };
  }
  if (isCombiningCodePoint(cp)) return { category: "combining" };
  if (isVariationSelector(cp)) return { category: "variation" };
  if (cp === 0xfffd) return { category: "other" };
  return null;
}

function iterateCodePoints(text) {
  const cps = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    cps.push(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return cps;
}

function detailName(cp, category, det) {
  const known = CHARS[cp];
  if (known) return known.name;
  if (category === "homoglyph") {
    return `Character resembling Latin “${det.ascii}” (${det.alphabet} alphabet)`;
  }
  if (category === "combining") return "Combining mark";
  if (category === "variation") return "Variation selector";
  if (category === "control") {
    return `Control character U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  if (category === "zeroWidth") return "Zero-width character";
  if (category === "other") {
    return `Character U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  if (category === "bidi") return "Bidirectional control";
  return "Hidden character";
}

function detailExplanation(cp, category, det) {
  const specific = SPECIFIC_EXPLANATIONS[cp];
  if (specific) return specific;
  if (category === "homoglyph" && det.ascii) {
    return `Look-alike: this ${det.alphabet.toLowerCase()} character renders almost identically to the Latin letter “${det.ascii}” in most fonts. In a string meant to be English it's a classic homograph spoofing marker.`;
  }
  return CATEGORY_EXPLANATION[category];
}

// Analysed result:
//   verdict      — "dangerous" | "suspicious" | "clean"
//   categories   — occurrence counts per category
//   hiddenCount  — total flagged occurrences
//   totalCodepoints
//   flagged      — one entry per unique flagged code point, with count,
//                  explanation, and severity
//   coded        — per-code-point sequence (flagged + normal) for rendering
//                  the text with hidden characters made visible
export function analyzeUnicode(text) {
  const categories = {
    bidi: 0,
    zeroWidth: 0,
    softHyphen: 0,
    control: 0,
    homoglyph: 0,
    combining: 0,
    variation: 0,
    other: 0,
  };

  const occurrenceCount = new Map();
  const coded = [];
  let hiddenCount = 0;

  for (const cp of iterateCodePoints(String(text ?? ""))) {
    const det = classify(cp);
    if (det) {
      hiddenCount += 1;
      categories[det.category] += 1;
      occurrenceCount.set(cp, (occurrenceCount.get(cp) ?? 0) + 1);
    }
    coded.push({
      cp,
      char: String.fromCodePoint(cp),
      category: det?.category ?? null,
      severity: det ? CATEGORY_CONFIG[det.category].severity : null,
      name: det ? detailName(cp, det.category, det) : null,
    });
  }

  let hasDanger = false;
  let hasWarning = false;
  const flagged = [];
  for (const [cp, count] of occurrenceCount) {
    const det = classify(cp);
    const severity = CATEGORY_CONFIG[det.category].severity;
    if (severity === DANGER) hasDanger = true;
    if (severity === WARNING) hasWarning = true;
    flagged.push({
      cp,
      char: String.fromCodePoint(cp),
      hex: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      name: detailName(cp, det.category, det),
      category: det.category,
      severity,
      count,
      explanation: detailExplanation(cp, det.category, det),
      homoglyph: det.ascii ?? null,
    });
  }
  flagged.sort((a, b) => {
    const rank = { [DANGER]: 0, [WARNING]: 1, [INFO]: 2 };
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
    return a.cp - b.cp;
  });

  const verdict = hasDanger ? "dangerous" : hasWarning ? "suspicious" : "clean";

  return {
    verdict,
    categories,
    hiddenCount,
    totalCodepoints: coded.length,
    flagged,
    coded,
  };
}