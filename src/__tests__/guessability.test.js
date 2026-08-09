// Tests for src/lib/guessability.js
//
// What we're checking:
//   - analyzePassword returns null for empty input
//   - matchedWords surfaces the dictionary words zxcvbn actually matched
//   - wordPhraseNote flags short all-common-word phrases ("hello world") where
//     zxcvbn's growing-sequence floor can overstate the score, but not
//     single words, mixed-case, or four-word passphrases
//   - the score itself is zxcvbn-ts's own (this is faithful reporting, not a
//     reimplementation)

import { describe, it, expect } from "vitest";
import { analyzePassword } from "@/lib/guessability";

describe("analyzePassword", () => {
  it("returns null for empty input", () => {
    expect(analyzePassword("")).toBeNull();
    expect(analyzePassword(undefined)).toBeNull();
    expect(analyzePassword(null)).toBeNull();
  });

  it("surfaces the dictionary words zxcvbn matched", () => {
    const result = analyzePassword("hello world");
    expect(result.matchedWords).toEqual(
      expect.arrayContaining(["hello", "world"])
    );
  });

  it("flags short all-common-word phrases with wordPhraseNote", () => {
    for (const password of ["hello world", "hello there", "let me in"]) {
      const result = analyzePassword(password);
      expect(result.wordPhraseNote).toBe(true);
    }
  });

  it("does not flag a single word", () => {
    const result = analyzePassword("password");
    expect(result.wordPhraseNote).toBe(false);
  });

  it("does not flag a four-word passphrase", () => {
    const result = analyzePassword("correct horse battery staple");
    expect(result.wordPhraseNote).toBe(false);
    expect(result.matchedWords.length).toBeGreaterThanOrEqual(3);
  });

  it("does not flag mixed-case or symbol-bearing passwords", () => {
    expect(analyzePassword("Hello World").wordPhraseNote).toBe(false);
    expect(analyzePassword("Tr0ub4dor&3").wordPhraseNote).toBe(false);
  });

  it("keeps zxcvbn's own score (reference behavior, documented)", () => {
    // These scores match the reference dropbox zxcvbn — the module reports
    // zxcvbn's verdict rather than overriding it; wordPhraseNote adds context.
    expect(analyzePassword("password").score).toBe(0);
    expect(analyzePassword("hello world").score).toBe(3);
  });
});
