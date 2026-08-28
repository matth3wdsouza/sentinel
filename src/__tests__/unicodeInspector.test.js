import { describe, it, expect } from "vitest";
import {
  analyzeUnicode,
  DANGER,
  WARNING,
  INFO,
  CATEGORY_CONFIG,
} from "@/lib/unicodeInspector";

function flaggedFor(text) {
  const result = analyzeUnicode(text);
  return { result, byCategory: (cat) => result.flagged.filter((f) => f.category === cat) };
}

describe("analyzeUnicode", () => {
  it("returns clean for plain ASCII text", () => {
    const result = analyzeUnicode("hello world");
    expect(result.verdict).toBe("clean");
    expect(result.flagged).toHaveLength(0);
    expect(result.hiddenCount).toBe(0);
  });

  it("flags a RIGHT-TO-LEFT OVERRIDE as dangerous", () => {
    const { result } = flaggedFor("evil\u202Eabcdef");
    expect(result.verdict).toBe("dangerous");
    expect(result.categories.bidi).toBe(1);
    expect(result.flagged[0]).toMatchObject({
      category: "bidi",
      severity: DANGER,
      hex: "U+202E",
      name: "RIGHT-TO-LEFT OVERRIDE",
    });
  });

  it("flags zero-width characters as warning", () => {
    const { result } = flaggedFor("pas\u200Bsword");
    expect(result.verdict).toBe("suspicious");
    expect(result.categories.zeroWidth).toBe(1);
    expect(result.flagged[0]).toMatchObject({
      category: "zeroWidth",
      severity: WARNING,
      name: "ZERO WIDTH SPACE",
    });
  });

  it("flags a zero-width joiner and non-joiner", () => {
    const { result } = flaggedFor("\u200C\u200D");
    expect(result.categories.zeroWidth).toBe(2);
  });

  it("flags a BOM (U+FEFF) as zero-width", () => {
    const { result } = flaggedFor("\uFEFFtext");
    expect(result.categories.zeroWidth).toBe(1);
    expect(result.flagged[0].name).toContain("BOM");
  });

  it("flags a soft hyphen as warning", () => {
    const { result } = flaggedFor("super\u00ADsecret");
    expect(result.verdict).toBe("suspicious");
    expect(result.categories.softHyphen).toBe(1);
    expect(result.flagged[0]).toMatchObject({ severity: WARNING });
  });

  it("flags look-alike Cyrillic homoglyphs with their Latin doppelganger", () => {
    const { result, byCategory } = flaggedFor("paypal".replace("a", "\u0430"));
    expect(result.verdict).toBe("suspicious");
    const homoglyphs = byCategory("homoglyph");
    expect(homoglyphs).toHaveLength(1);
    expect(homoglyphs[0]).toMatchObject({
      severity: WARNING,
      homoglyph: "a",
      name: "CYRILLIC SMALL LETTER A",
    });
  });

  it("warns on a Greek omicron resembling Latin o", () => {
    const { result, byCategory } = flaggedFor("m\u03BFney");
    expect(byCategory("homoglyph")[0]).toMatchObject({
      homoglyph: "o",
      name: "GREEK SMALL LETTER OMICRON",
    });
    expect(result.verdict).toBe("suspicious");
  });

  it("flags a real control character but not tab/newline/CR", () => {
    const { result } = flaggedFor("a\u0000b\tc\nd\r");
    expect(result.categories.control).toBe(1);
    expect(result.flagged[0]).toMatchObject({
      category: "control",
      severity: WARNING,
    });
  });

  it("treats an ASCII combining accent as info and keeps verdict clean", () => {
    const { result, byCategory } = flaggedFor("e\u0301");
    expect(byCategory("combining").length).toBe(1);
    expect(byCategory("combining")[0].severity).toBe(INFO);
    expect(result.verdict).toBe("clean");
  });

  it("flags variation selectors as info", () => {
    const { result, byCategory } = flaggedFor("a\uFE0F");
    expect(byCategory("variation").length).toBe(1);
    expect(result.verdict).toBe("clean");
  });

  it("gives danger precedence when bidi and combining mix", () => {
    const { result } = flaggedFor("e\u0301\u202Eoops");
    expect(result.verdict).toBe("dangerous");
    expect(result.hiddenCount).toBe(2);
  });

  it("tallies per-category and total counts", () => {
    const { result } = flaggedFor("\u200Bx\u200D\u00AD");
    expect(result.hiddenCount).toBe(3);
    expect(result.categories.zeroWidth).toBe(2);
    expect(result.categories.softHyphen).toBe(1);
  });

  it("sorts flagged entries danger-first", () => {
    const { result } = flaggedFor("\u00AD\u200B\u202E");
    expect(result.flagged.map((f) => f.severity)).toEqual([DANGER, WARNING, WARNING]);
  });

  it("groups repeated occurrences of the same code point with a count", () => {
    const { result } = flaggedFor("\u200B\u200B\u200B");
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].count).toBe(3);
  });

  it("builds a per-code-point coded sequence", () => {
    const { result } = flaggedFor("a\u202Eb");
    expect(result.coded).toHaveLength(3);
    expect(result.coded[1]).toMatchObject({
      cp: 0x202e,
      category: "bidi",
      severity: DANGER,
    });
    expect(result.coded[0].category).toBeNull();
    expect(result.coded[2].category).toBeNull();
  });

  it("handles non-BMP code points without splitting them", () => {
    const { result } = flaggedFor("😀x");
    expect(result.totalCodepoints).toBe(2);
    expect(result.coded[0].cp).toBeGreaterThan(0xffff);
    expect([...result.coded].filter((c) => !c.category)).toHaveLength(2);
    expect(result.verdict).toBe("clean");
  });

  it("returns a clean empty result for an empty string", () => {
    const result = analyzeUnicode("");
    expect(result.verdict).toBe("clean");
    expect(result.totalCodepoints).toBe(0);
    expect(result.flagged).toHaveLength(0);
  });

  it("is safe for null/undefined input", () => {
    expect(analyzeUnicode(null).totalCodepoints).toBe(0);
    expect(analyzeUnicode(undefined).verdict).toBe("clean");
  });

  it("exposes an explanation for every flagged entry", () => {
    const { result } = flaggedFor("\u202E\u200B\u0430\u0301");
    for (const entry of result.flagged) {
      expect(entry.explanation.length).toBeGreaterThan(0);
    }
  });

  it("matches CATEGORY_CONFIG severities to flagged severities", () => {
    const { result } = flaggedFor("\uFEFF\u202E");
    for (const entry of result.flagged) {
      expect(CATEGORY_CONFIG[entry.category].severity).toBe(entry.severity);
    }
  });

  it("warns on a fullwidth full stop resembling a dot", () => {
    const { result, byCategory } = flaggedFor("example.com".replace(".", "\uFF0E"));
    expect(byCategory("homoglyph")[0]).toMatchObject({
      homoglyph: ".",
      name: "FULLWIDTH FULL STOP",
    });
    expect(result.verdict).toBe("suspicious");
  });

  it("gives a specific explanation for the RLO override", () => {
    const { result } = flaggedFor("\u202E");
    expect(result.flagged[0].explanation).toContain("RIGHT-TO-LEFT OVERRIDE");
  });
});