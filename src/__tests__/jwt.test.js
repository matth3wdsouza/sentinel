// Tests for src/lib/jwt.js
//
// What we're checking:
//   - decodeSegment decodes base64url JSON (known jwt.io vector + self-built)
//   - parseJWT splits header/payload/signature and decodes JSON
//   - MALFORMED for wrong segment counts, BAD_HEADER/BAD_PAYLOAD for bad JSON
//   - relativeTime bucket boundaries (seconds/minutes/hours/days, past/future)
//     against a fixed clock, plus "n/a" for non-finite timestamps
//   - formatTimestamp "n/a" for non-finite/invalid dates

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  decodeSegment,
  parseJWT,
  formatTimestamp,
  relativeTime,
} from "@/lib/jwt";

afterEach(() => {
  vi.useRealTimers();
});

const HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"; // {"alg":"HS256","typ":"JWT"}
const PAYLOAD = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
const SIGNATURE = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("decodeSegment", () => {
  it("decodes a known base64url JSON vector", () => {
    expect(decodeSegment(HEADER)).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("decodes unpadded base64url", () => {
    // "{}" unpadded
    expect(decodeSegment("e30")).toEqual({});
  });
});

describe("parseJWT", () => {
  it("parses a three-segment token", () => {
    const token = `${HEADER}.${PAYLOAD}.${SIGNATURE}`;
    const parsed = parseJWT(token);
    expect(parsed.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(parsed.payload.sub).toBe("1234567890");
    expect(parsed.payload.name).toBe("John Doe");
    expect(parsed.payload.iat).toBe(1516239022);
    expect(parsed.signature).toBe(SIGNATURE);
  });

  it("trims surrounding whitespace", () => {
    const token = `  ${HEADER}.${PAYLOAD}.${SIGNATURE}\n`;
    expect(parseJWT(token).payload.sub).toBe("1234567890");
  });

  it("throws MALFORMED for wrong segment counts", () => {
    expect(() => parseJWT("a.b")).toThrow("MALFORMED");
    expect(() => parseJWT("a")).toThrow("MALFORMED");
    expect(() => parseJWT("a.b.c.d")).toThrow("MALFORMED");
  });

  it("throws BAD_HEADER when the header segment is not JSON", () => {
    // base64url("not json")
    expect(() => parseJWT(`bm90IGpzb24.e30.${SIGNATURE}`)).toThrow("BAD_HEADER");
  });

  it("throws BAD_PAYLOAD when the payload segment is not JSON", () => {
    expect(() => parseJWT(`${HEADER}.bm90IGpzb24.${SIGNATURE}`)).toThrow("BAD_PAYLOAD");
  });
});

describe("relativeTime", () => {
  const NOW = new Date("2026-01-01T00:00:00Z");

  function at(diffSec) {
    const unix = Math.floor(NOW.getTime() / 1000) + diffSec;
    return relativeTime(unix);
  }

  it("renders sub-minute differences in seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(at(5)).toBe("in a few seconds");
    expect(at(-5)).toBe("a few seconds ago");
  });

  it("renders minutes (under an hour)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(at(120)).toBe("in 2m");
    expect(at(-120)).toBe("2m ago");
  });

  it("renders hours (under a day)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(at(7200)).toBe("in 2h");
    expect(at(-7200)).toBe("2h ago");
  });

  it("renders days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(at(172800)).toBe("in 2d");
    expect(at(-172800)).toBe("2d ago");
  });

  it("returns n/a for non-finite timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(NaN)).toBe("n/a");
    expect(relativeTime(Infinity)).toBe("n/a");
    expect(relativeTime(-Infinity)).toBe("n/a");
    expect(relativeTime(undefined)).toBe("n/a");
  });
});

describe("formatTimestamp", () => {
  it("formats a valid timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const formatted = formatTimestamp(1767225600); // 2026-01-01T00:00:00Z
    expect(formatted).not.toBe("n/a");
    expect(formatted).toMatch(/\d/);
  });

  it("returns n/a for non-finite or invalid timestamps", () => {
    expect(formatTimestamp(NaN)).toBe("n/a");
    expect(formatTimestamp(Infinity)).toBe("n/a");
    expect(formatTimestamp(undefined)).toBe("n/a");
  });
});
