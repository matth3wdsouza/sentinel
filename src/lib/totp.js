// totp.js — TOTP parsing and secret generation helpers.
// Pure logic for the TOTP module. No secrets are ever stored or logged.

import * as OTPAuth from "otpauth";

// Generate a random Base32 secret — 32 chars from 32 CSPRNG bytes. Each byte
// contributes 5 bits via `b % 32` (32 divides 256 evenly, so the mapping is
// unbiased) = 160 bits of entropy, matching the 32-char/160-bit convention
// for TOTP shared secrets (RFC 4226 recommends at least 128-bit secrets).
export function generateRandomSecret() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => alphabet[b % 32]).join("");
}

// Parse input — either a raw Base32 secret or a full otpauth:// URI.
// Returns an OTPAuth.TOTP instance.
export function parseTOTP(input) {
  const val = input.trim();
  if (val.startsWith("otpauth://")) {
    const parsed = OTPAuth.URI.parse(val);
    if (!(parsed instanceof OTPAuth.TOTP)) throw new Error("NOT_TOTP");
    return parsed;
  }
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(val) });
}
