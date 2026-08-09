// Tests for src/lib/totp.js
//
// What we're checking:
//   - parseTOTP accepts a raw Base32 secret and an otpauth://totp URI
//   - parseTOTP rejects non-TOTP otpauth schemes (NOT_TOTP) and bad Base32
//   - generateRandomSecret produces valid, varying Base32 secrets
//   - the resulting TOTP generates a 6-digit code

import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { parseTOTP, generateRandomSecret } from "@/lib/totp";

const SECRET = "JBSWY3DPEHPK3PXP";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

describe("parseTOTP", () => {
  it("parses a raw Base32 secret", () => {
    const totp = parseTOTP(SECRET);
    expect(totp).toBeInstanceOf(OTPAuth.TOTP);
  });

  it("parses an otpauth://totp URI", () => {
    const uri = `otpauth://totp/Example:alice@example.com?secret=${SECRET}&issuer=Example`;
    const totp = parseTOTP(uri);
    expect(totp).toBeInstanceOf(OTPAuth.TOTP);
  });

  it("trims surrounding whitespace", () => {
    expect(parseTOTP(`  ${SECRET}  `)).toBeInstanceOf(OTPAuth.TOTP);
  });

  it("throws NOT_TOTP for a non-TOTP otpauth scheme", () => {
    // HOTP is a valid otpauth scheme but not TOTP — counter is required for
    // URI.parse to succeed, otherwise it throws before the type check.
    expect(() => parseTOTP(`otpauth://hotp/Example?secret=${SECRET}&counter=0`)).toThrow("NOT_TOTP");
  });

  it("throws for an otpauth URI missing required params", () => {
    expect(() => parseTOTP(`otpauth://hotp/Example?secret=${SECRET}`)).toThrow();
  });

  it("throws for invalid Base32", () => {
    expect(() => parseTOTP("NOT VALID 123")).toThrow();
    expect(() => parseTOTP("not base32!")).toThrow();
  });

  it("generates a 6-digit code from a parsed secret", () => {
    const totp = parseTOTP(SECRET);
    expect(totp.generate()).toMatch(/^\d{6}$/);
  });
});

describe("generateRandomSecret", () => {
  it("returns a 32-character Base32 string", () => {
    const secret = generateRandomSecret();
    expect(secret).toHaveLength(32);
    for (const ch of secret) {
      expect(BASE32_ALPHABET).toContain(ch);
    }
  });

  it("produces varying secrets", () => {
    const a = generateRandomSecret();
    const b = generateRandomSecret();
    expect(a).not.toBe(b);
  });

  it("generates a valid TOTP when parsed back", () => {
    const secret = generateRandomSecret();
    const totp = parseTOTP(secret);
    expect(totp.generate()).toMatch(/^\d{6}$/);
  });
});
