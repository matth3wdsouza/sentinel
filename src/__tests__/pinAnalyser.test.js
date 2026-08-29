import { describe, it, expect } from "vitest";
import {
  analyzePIN,
  DANGER,
  WARNING,
  INFO,
  MAX_PIN_LENGTH,
} from "@/lib/pinAnalyser";

function patternsOf(input) {
  return analyzePIN(input).patterns.map((p) => p.tier);
}

describe("analyzePIN basics", () => {
  it("returns null for empty, null, or whitespace", () => {
    expect(analyzePIN("")).toBeNull();
    expect(analyzePIN("   \n\t ")).toBeNull();
    expect(analyzePIN(null)).toBeNull();
    expect(analyzePIN(undefined)).toBeNull();
  });

  it("reports isNumeric false for non-digit input", () => {
    const result = analyzePIN("abcd");
    expect(result.isNumeric).toBe(false);
    expect(result.verdict).toBeNull();
  });

  it("normalises spaces, dashes, and dots", () => {
    const result = analyzePIN("12 34-56");
    expect(result.length).toBe(6);
    expect(result.isNumeric).toBe(true);
  });
});

describe("top-common PIN list", () => {
  it("flags 1234 as weak (danger tier)", () => {
    const result = analyzePIN("1234");
    expect(result.verdict).toBe("weak");
    expect(result.patterns.some((p) => p.id === "common-list" && p.tier === DANGER)).toBe(true);
  });

  it("flags 2580 via the well-known set", () => {
    const result = analyzePIN("2580");
    expect(patternsOf("2580")).toContain(WARNING);
  });

  it("flags a repeated-digit classic like 1111 as weak", () => {
    expect(analyzePIN("1111").verdict).toBe("weak");
  });
});

describe("repeated digits", () => {
  it("treats a single repeated digit as danger", () => {
    const result = analyzePIN("1111");
    const repeat = result.patterns.find((p) => p.id === "repeat");
    expect(repeat.tier).toBe(DANGER);
  });

  it("flags long back-to-back runs as warning", () => {
    const result = analyzePIN("111234");
    const repeat = result.patterns.find((p) => p.id === "repeat");
    expect(repeat?.tier).toBe(WARNING);
  });
});

describe("sequences", () => {
  it("flags ascending sequences like 1234", () => {
    const result = analyzePIN("1234");
    expect(result.patterns.some((p) => p.id === "sequence" && p.tier === WARNING)).toBe(true);
  });

  it("flags descending sequences like 9876", () => {
    expect(patternsOf("9876")).toContain(WARNING);
  });

  it("flags a longer sequence like 456789", () => {
    expect(patternsOf("456789")).toContain(WARNING);
  });

  it("does not flag an alternating pair as a sequence", () => {
    const seq = analyzePIN("1212").patterns.find((p) => p.id === "sequence");
    expect(seq).toBeUndefined();
  });
});

describe("couplets", () => {
  it("flags repeating pairs like 1212 and 4545", () => {
    expect(analyzePIN("1212").patterns.some((p) => p.id === "couplet")).toBe(true);
    expect(analyzePIN("4545").patterns.some((p) => p.id === "couplet")).toBe(true);
    expect(analyzePIN("121212").patterns.some((p) => p.id === "couplet")).toBe(true);
  });
});

describe("dates", () => {
  it("flags 19xx and 20xx years", () => {
    expect(patternsOf("1990")).toContain(WARNING);
    expect(patternsOf("2020")).toContain(WARNING);
  });

  it("flags MMDD forms", () => {
    expect(patternsOf("0714")).toContain(WARNING);
  });

  it("flags 6-digit dates", () => {
    expect(patternsOf("140719")).toContain(WARNING);
  });
});

describe("strong verdict", () => {
  it("returns strong for a pattern-free PIN, with an entropy info note", () => {
    const result = analyzePIN("8068");
    expect(result.verdict).toBe("strong");
    const entropy = result.patterns.find((p) => p.id === "entropy");
    expect(entropy?.tier).toBe(INFO);
  });

  it("returns strong for a random 6-digit PIN", () => {
    expect(analyzePIN("482913").verdict).toBe("strong");
  });
});

describe("verdict tiering", () => {
  it("weak when any danger-tier pattern fires", () => {
    expect(analyzePIN("1111").verdict).toBe("weak");
  });

  it("fair when only warning/info fire", () => {
    const result = analyzePIN("1990");
    expect(result.verdict).toBe("fair");
    expect(result.patterns.some((p) => p.tier === DANGER)).toBe(false);
  });
});

describe("length cap", () => {
  it("caps analysis at MAX_PIN_LENGTH", () => {
    const long = "123456789012345";
    const result = analyzePIN(long);
    expect(result.length).toBe(MAX_PIN_LENGTH);
  });
});

describe("privacy-safe output shape", () => {
  it("never exposes the PIN itself in the result object", () => {
    const secret = "8427";
    const result = analyzePIN(secret);
    const serialized = JSON.stringify(result);
    expect(serialized.includes(secret)).toBe(false);
  });
});
