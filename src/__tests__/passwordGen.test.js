// Tests for src/lib/passwordGen.js
//
// What we're checking:
//   - buildCharset applies ambiguous/custom exclusions per class and drops
//     fully-excluded classes
//   - secureRandomInt's rejection sampling has no modulo bias (with a mocked
//     CSPRNG that hands back out-of-range draws, so the re-draw path is
//     exercised deterministically)
//   - secureShuffle is a true permutation and is deterministic given the RNG
//   - entropy math: exact unconstrained entropy and exact inclusion-exclusion
//     entropy for the "guarantee one of each class" constraint (hand-verified
//     small cases plus a pinned constant for the real charset)
//   - generatePassword honours options, enforces its invariants, and reports
//     the same entropy the exposed helpers compute

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CHARSET_CLASSES,
  buildCharset,
  secureRandomInt,
  secureShuffle,
  calculateEntropy,
  calculateGuaranteedEntropy,
  generatePassword,
} from "@/lib/passwordGen";

afterEach(() => {
  vi.restoreAllMocks();
});

// Drives secureRandomInt deterministically. Each draw consumes one value from
// the queue (getRandomValues fills a 1-element Uint32Array).
function mockRandomValues(queue) {
  let i = 0;
  return vi.spyOn(crypto, "getRandomValues").mockImplementation((buffer) => {
    buffer[0] = queue[i++ % queue.length];
    return buffer;
  });
}

describe("buildCharset", () => {
  it("builds all four classes with the default options", () => {
    const options = {
      lowercase: true, uppercase: true, digits: true, symbols: true,
      excludeAmbiguous: false, customExclusions: "",
    };
    const { classes, fullCharset } = buildCharset(options);
    expect(classes.map((c) => c.name)).toEqual([
      "lowercase", "uppercase", "digits", "symbols",
    ]);
    expect(fullCharset.length).toBe(88);
  });

  it("drops disabled and fully-excluded classes", () => {
    const { classes, fullCharset } = buildCharset({
      lowercase: true, uppercase: false, digits: false, symbols: false,
      excludeAmbiguous: false, customExclusions: "",
    });
    expect(classes).toEqual([{ name: "lowercase", chars: CHARSET_CLASSES.lowercase }]);
    expect(fullCharset).toBe(CHARSET_CLASSES.lowercase);
  });

  it("returns empty when every class is disabled", () => {
    const { classes, fullCharset } = buildCharset({
      lowercase: false, uppercase: false, digits: false, symbols: false,
      excludeAmbiguous: false, customExclusions: "",
    });
    expect(classes).toEqual([]);
    expect(fullCharset).toBe("");
  });

  it("excludes ambiguous characters from every class that contains them", () => {
    const { classes, fullCharset } = buildCharset({
      lowercase: true, uppercase: true, digits: true, symbols: true,
      excludeAmbiguous: true, customExclusions: "",
    });
    // 26+26+10+26 minus the six chars in "0OoIl1".
    expect(fullCharset.length).toBe(82);
    for (const c of classes) {
      expect(c.chars).not.toMatch(/[0OoIl1]/);
    }
  });

  it("excludes custom characters and leaves ambiguous ones alone", () => {
    const { fullCharset } = buildCharset({
      lowercase: true, uppercase: true, digits: true, symbols: true,
      excludeAmbiguous: false, customExclusions: "abc",
    });
    expect(fullCharset.length).toBe(85);
    expect(fullCharset).not.toMatch(/[abc]/);
  });
});

describe("secureRandomInt", () => {
  it("rejects invalid max values", () => {
    expect(() => secureRandomInt(0)).toThrow("positive integer");
    expect(() => secureRandomInt(-3)).toThrow("positive integer");
    expect(() => secureRandomInt(4.5)).toThrow("positive integer");
    expect(() => secureRandomInt(0x100000001)).toThrow("exceeds supported range");
  });

  it("returns values strictly in [0, max)", () => {
    mockRandomValues([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 0; i < 100; i++) {
      expect(secureRandomInt(7)).toBeGreaterThanOrEqual(0);
      expect(secureRandomInt(7)).toBeLessThan(7);
    }
  });

  it("never draws from the biased tail when max doesn't divide 2^32", () => {
    // max = 10 -> largestMultiple = 4294967290. Values >= that are rejected
    // and re-drawn, so a hostile RNG can never smuggle a biased value through.
    const spy = mockRandomValues([4294967290, 4294967295, 7]);
    expect(secureRandomInt(10)).toBe(7);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("handles max = 2^32 (the full range, no rejection needed)", () => {
    mockRandomValues([0xffffffff]);
    expect(secureRandomInt(0x100000000)).toBe(0xffffffff);
  });

  it("handles max = 1 (always returns 0)", () => {
    mockRandomValues([12345]);
    expect(secureRandomInt(1)).toBe(0);
  });
});

describe("secureShuffle", () => {
  it("is a permutation — same elements, same length", () => {
    const input = ["a", "b", "c", "d", "e"];
    const shuffled = secureShuffle([...input]);
    expect(shuffled.sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(shuffled).toHaveLength(input.length);
  });

  it("reorders deterministically for a fixed draw sequence", () => {
    mockRandomValues([0, 0, 0]);
    expect(secureShuffle(["a", "b", "c", "d"])).toEqual(["b", "c", "d", "a"]);
  });

  it("leaves empty and single-element arrays unchanged", () => {
    mockRandomValues([0]);
    expect(secureShuffle([])).toEqual([]);
    expect(secureShuffle(["solo"])).toEqual(["solo"]);
  });
});

describe("calculateEntropy", () => {
  it("is length * log2(charsetSize)", () => {
    expect(calculateEntropy(94, 16)).toBeCloseTo(104.8734, 3);
  });

  it("is 0 for an empty password", () => {
    expect(calculateEntropy(94, 0)).toBe(0);
  });
});

describe("calculateGuaranteedEntropy", () => {
  it("computes the hand-verified small case exactly (3 bits)", () => {
    // 2 classes of size 2 in a 4-char alphabet, length 2:
    // 4^2 - 2^2 - 2^2 + 0^2 = 8 valid strings -> log2(8) = 3.
    expect(calculateGuaranteedEntropy([2, 2], 4, 2)).toBeCloseTo(3, 10);
  });

  it("computes another small case exactly (1 bit)", () => {
    // 2 classes of size 1 in a 2-char alphabet, length 2: 4 - 1 - 1 = 2 -> 1.
    expect(calculateGuaranteedEntropy([1, 1], 2, 2)).toBeCloseTo(1, 10);
  });

  it("pins the real-charset value (slightly below unconstrained)", () => {
    // 4 disjoint classes (26,26,10,26) in an 88-char alphabet, length 16.
    const guaranteed = calculateGuaranteedEntropy([26, 26, 10, 26], 88, 16);
    expect(guaranteed).toBeCloseTo(103.1070, 3);
    expect(guaranteed).toBeLessThan(calculateEntropy(88, 16));
  });
});

describe("generatePassword", () => {
  it("returns a password matching the requested length and charset", () => {
    const result = generatePassword();
    expect(result.length).toBe(16);
    expect(result.charsetSize).toBe(88);
    expect(result.guaranteeOneOfEach).toBe(false);
    expect(result.classesUsed).toEqual(["lowercase", "uppercase", "digits", "symbols"]);
    expect(result.entropyBits).toBeCloseTo(103.3509, 3);
    for (const ch of result.password) {
      expect(ch).toMatch(/[a-zA-Z0-9!@#$%^&*()\-_=+\[\]{};:,.<>/?]/);
    }
  });

  it("honours custom options and drops disabled classes", () => {
    const result = generatePassword({
      length: 8, lowercase: true, uppercase: false,
      digits: false, symbols: false,
    });
    expect(result.length).toBe(8);
    expect(result.charsetSize).toBe(26);
    expect(result.classesUsed).toEqual(["lowercase"]);
    expect(result.password).toMatch(/^[a-z]+$/);
    expect(result.entropyBits).toBeCloseTo(8 * Math.log2(26), 3);
  });

  it("excludes ambiguous characters when asked", () => {
    const result = generatePassword({
      length: 64, excludeAmbiguous: true,
    });
    expect(result.password).not.toMatch(/[0OoIl1]/);
    expect(result.charsetSize).toBe(82);
  });

  it("guarantees one of each class and reports inclusion-exclusion entropy", () => {
    const result = generatePassword({ length: 16, guaranteeOneOfEach: true });
    expect(result.guaranteeOneOfEach).toBe(true);
    // Membership checks rather than a regex — symbol classes contain regex
    // metacharacters that would break a character class.
    for (const chars of Object.values(CHARSET_CLASSES)) {
      expect([...result.password].some((ch) => chars.includes(ch))).toBe(true);
    }
    expect(result.entropyBits).toBeCloseTo(103.1070, 3);
  });

  it("throws when no character classes are enabled", () => {
    expect(() =>
      generatePassword({
        lowercase: false, uppercase: false, digits: false, symbols: false,
      })
    ).toThrow("No characters available to generate from");
  });

  it("throws when guaranteeOneOfEach needs more length than classes", () => {
    expect(() => generatePassword({ length: 2, guaranteeOneOfEach: true })).toThrow(
      "Length must be at least 4"
    );
  });
});
