// Tests for src/lib/wordlist.js
//
// What we're checking:
//   - parseWordlist's contract: one word per line, blank lines dropped,
//     case-insensitive dedup keeping the first occurrence's casing, and the
//     four stats it reports
//   - validateWordlist's threshold logic (128 unusable / 1024 weak) and the
//     duplicate-ratio escalation
//   - entropy math (per-word and total) and the strengthLabel boundaries
//   - generatePassphrase's drawing, separators, case transforms, and error
//     cases (deterministic draws via a mocked CSPRNG)

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseWordlist,
  validateWordlist,
  entropyPerWord,
  totalEntropy,
  strengthLabel,
  generatePassphrase,
} from "@/lib/wordlist";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockRandomValues(queue) {
  let i = 0;
  return vi.spyOn(crypto, "getRandomValues").mockImplementation((buffer) => {
    buffer[0] = queue[i++ % queue.length];
    return buffer;
  });
}

describe("parseWordlist", () => {
  it("drops blank lines and dedups case-insensitively, keeping first casing", () => {
    const parsed = parseWordlist("alpha\nbeta\nalpha\n\n  \nGamma\ngamma\r\n");
    expect(parsed.words).toEqual(["alpha", "beta", "Gamma"]);
    expect(parsed.rawCount).toBe(5);
    expect(parsed.uniqueCount).toBe(3);
    expect(parsed.duplicateCount).toBe(2);
    expect(parsed.blankLinesDropped).toBe(3);
  });

  it("handles CRLF line endings and a trailing newline", () => {
    const parsed = parseWordlist("one\r\ntwo\r\nthree\r\n");
    expect(parsed.words).toEqual(["one", "two", "three"]);
    expect(parsed.rawCount).toBe(3);
    expect(parsed.blankLinesDropped).toBe(1);
  });

  it("trims surrounding whitespace from every word", () => {
    const parsed = parseWordlist("  padded  \n\t tabbed \n");
    expect(parsed.words).toEqual(["padded", "tabbed"]);
  });

  it("returns empty stats for an empty input", () => {
    const parsed = parseWordlist("");
    expect(parsed.words).toEqual([]);
    expect(parsed.rawCount).toBe(0);
    expect(parsed.uniqueCount).toBe(0);
    expect(parsed.duplicateCount).toBe(0);
    expect(parsed.blankLinesDropped).toBe(1);
  });
});

describe("validateWordlist", () => {
  it("rejects a list with no usable words", () => {
    const verdict = validateWordlist({ uniqueCount: 0, duplicateCount: 0, rawCount: 0 });
    expect(verdict.level).toBe("error");
    expect(verdict.issues[0]).toMatch(/no usable words/i);
  });

  it("errors below the unusable threshold", () => {
    const verdict = validateWordlist({ uniqueCount: 100, duplicateCount: 0, rawCount: 100 });
    expect(verdict.level).toBe("error");
    expect(verdict.issues[0]).toMatch(/below the 128-word minimum/i);
  });

  it("warns at the exact unusable boundary (128) and below the weak threshold", () => {
    expect(validateWordlist({ uniqueCount: 128, duplicateCount: 0, rawCount: 128 }).level).toBe("warning");
    expect(validateWordlist({ uniqueCount: 200, duplicateCount: 0, rawCount: 200 }).level).toBe("warning");
  });

  it("is ok at the exact weak threshold (1024) and above", () => {
    expect(validateWordlist({ uniqueCount: 1024, duplicateCount: 0, rawCount: 1024 }).level).toBe("ok");
    expect(validateWordlist({ uniqueCount: 7776, duplicateCount: 0, rawCount: 7776 }).level).toBe("ok");
  });

  it("escalates to a warning when duplicates exceed the ratio", () => {
    const verdict = validateWordlist({
      uniqueCount: 5000, duplicateCount: 3000, rawCount: 8000,
    });
    expect(verdict.level).toBe("warning");
    expect(verdict.issues.some((i) => /duplicate/i.test(i))).toBe(true);
  });

  it("stays at its level when duplicates stay under the ratio", () => {
    const verdict = validateWordlist({
      uniqueCount: 5000, duplicateCount: 5, rawCount: 8000,
    });
    expect(verdict.level).toBe("ok");
  });
});

describe("entropy math", () => {
  it("computes per-word entropy for the EFF list", () => {
    expect(entropyPerWord(7776)).toBeCloseTo(12.9248, 3);
  });

  it("computes total entropy additively", () => {
    expect(totalEntropy(7776, 6)).toBeCloseTo(77.5489, 3);
    expect(totalEntropy(7776, 6)).toBeCloseTo(6 * entropyPerWord(7776), 10);
  });
});

describe("strengthLabel", () => {
  it("maps the boundaries to the right label and verdict", () => {
    expect(strengthLabel(39)).toEqual({ label: "Weak", verdict: "mismatch" });
    expect(strengthLabel(40)).toEqual({ label: "Reasonable", verdict: "fallback" });
    expect(strengthLabel(59)).toEqual({ label: "Reasonable", verdict: "fallback" });
    expect(strengthLabel(60)).toEqual({ label: "Strong", verdict: "match" });
    expect(strengthLabel(79)).toEqual({ label: "Strong", verdict: "match" });
    expect(strengthLabel(80)).toEqual({ label: "Very strong", verdict: "success" });
    expect(strengthLabel(120)).toEqual({ label: "Very strong", verdict: "success" });
  });
});

describe("generatePassphrase", () => {
  it("draws deterministically for a fixed RNG sequence", () => {
    mockRandomValues([0, 1, 2]);
    const result = generatePassphrase({
      words: ["alpha", "beta", "gamma", "delta"],
      wordCount: 3,
    });
    expect(result.passphrase).toBe("alpha beta gamma");
    expect(result.words).toEqual(["alpha", "beta", "gamma"]);
  });

  it("applies the separator and case transforms", () => {
    mockRandomValues([0, 1, 2]);
    const hyphens = generatePassphrase({
      words: ["alpha", "beta", "gamma"], wordCount: 3, separator: "-",
    });
    expect(hyphens.passphrase).toBe("alpha-beta-gamma");

    mockRandomValues([0, 1, 2]);
    const capitalized = generatePassphrase({
      words: ["alpha", "beta", "gamma"], wordCount: 3, wordCase: "capitalize",
    });
    expect(capitalized.passphrase).toBe("Alpha Beta Gamma");

    mockRandomValues([0, 1, 2]);
    const upper = generatePassphrase({
      words: ["alpha", "beta", "gamma"], wordCount: 3, wordCase: "upper",
    });
    expect(upper.passphrase).toBe("ALPHA BETA GAMMA");
  });

  it("supports the None separator preset", () => {
    mockRandomValues([0, 1, 2]);
    const result = generatePassphrase({
      words: ["alpha", "beta", "gamma"], wordCount: 3, separator: "",
    });
    expect(result.passphrase).toBe("alphabetaGamma".toLowerCase());
  });

  it("only draws words present in the list", () => {
    const words = ["foo", "bar", "baz"];
    const result = generatePassphrase({ words, wordCount: 20 });
    for (const word of result.words) {
      expect(words).toContain(word);
    }
  });

  it("reports exact entropy fields", () => {
    mockRandomValues([0, 1, 2]);
    const result = generatePassphrase({
      words: ["a", "b", "c", "d"], wordCount: 3,
    });
    expect(result.listSize).toBe(4);
    expect(result.wordCount).toBe(3);
    expect(result.entropyPerWord).toBe(2);
    expect(result.entropyBits).toBe(6);
  });

  it("throws when there are no words", () => {
    expect(() => generatePassphrase({ words: [], wordCount: 3 })).toThrow(
      "No words available to generate from"
    );
    expect(() => generatePassphrase({ words: "not an array", wordCount: 3 })).toThrow(
      "No words available to generate from"
    );
  });

  it("throws on an invalid word count", () => {
    expect(() =>
      generatePassphrase({ words: ["a"], wordCount: 0 })
    ).toThrow("Word count must be a positive integer");
    expect(() =>
      generatePassphrase({ words: ["a"], wordCount: 2.5 })
    ).toThrow("Word count must be a positive integer");
  });
});
