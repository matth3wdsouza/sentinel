// Tests for src/lib/base64.js
//
// What we're checking:
//   - standard Base64 output against known vectors (including = padding)
//   - Base64url output: -/_ substitution, no = padding
//   - padding repair when decoding unpadded input (remainder 2 → "==", 3 → "=")
//   - unicode round-trips (TextEncoder/TextDecoder path)
//   - round-trip identity for both variants
//   - invalid base64 throws (atob)

import { describe, it, expect } from "vitest";
import { toBase64, fromBase64 } from "@/lib/base64";

describe("toBase64 (standard)", () => {
  it("encodes known vectors with correct padding", () => {
    expect(toBase64("", false)).toBe("");
    expect(toBase64("a", false)).toBe("YQ==");
    expect(toBase64("ab", false)).toBe("YWI=");
    expect(toBase64("abc", false)).toBe("YWJj");
    expect(toBase64("hello", false)).toBe("aGVsbG8=");
  });

  it("encodes unicode via UTF-8", () => {
    expect(toBase64("hello world", false)).toBe("aGVsbG8gd29ybGQ=");
    expect(toBase64("你好", false)).toBe("5L2g5aW9");
  });
});

describe("toBase64 (base64url)", () => {
  it("matches standard output with -/_ substitution and no padding", () => {
    const samples = ["hello", "你好", "a", "abc", "", "some/unsafe+bytes=="];
    for (const s of samples) {
      const std = toBase64(s, false);
      const url = toBase64(s, true);
      expect(url).toBe(std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    }
  });

  it("never contains +, /, or = padding", () => {
    const url = toBase64("???", true);
    expect(url).not.toMatch(/[+/=]/);
  });
});

describe("fromBase64 (standard)", () => {
  it("decodes known vectors", () => {
    expect(fromBase64("YQ==", false)).toBe("a");
    expect(fromBase64("YWI=", false)).toBe("ab");
    expect(fromBase64("YWJj", false)).toBe("abc");
    expect(fromBase64("aGVsbG8=", false)).toBe("hello");
  });

  it("round-trips standard output", () => {
    const samples = ["", "a", "ab", "abc", "hello world", "你好", "emoji 🎉"];
    for (const s of samples) {
      expect(fromBase64(toBase64(s, false), false)).toBe(s);
    }
  });
});

describe("fromBase64 (base64url + padding repair)", () => {
  it("repairs stripped padding (remainder 2 → ==, 3 → =)", () => {
    expect(fromBase64("aGVsbG8", true)).toBe("hello");
    expect(fromBase64("YQ", true)).toBe("a");
    expect(fromBase64("YWI", true)).toBe("ab");
    expect(fromBase64("YWJj", true)).toBe("abc");
  });

  it("round-trips base64url output", () => {
    const samples = ["", "a", "ab", "abc", "hello world", "你好", "emoji 🎉"];
    for (const s of samples) {
      expect(fromBase64(toBase64(s, true), true)).toBe(s);
    }
  });
});

describe("fromBase64 (invalid input)", () => {
  it("throws on characters outside the base64 alphabet", () => {
    expect(() => fromBase64("!!!", false)).toThrow();
  });

  it("throws on a truncated/invalid block", () => {
    expect(() => fromBase64("a", false)).toThrow();
    expect(() => fromBase64("YQ===", false)).toThrow();
  });
});
