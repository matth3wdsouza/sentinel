// Tests for src/lib/encrypt.js
//
// What we're checking:
//   - The happy path: encrypt then decrypt gives you back what you started with
//   - The failure paths: wrong passphrase, tampered data, and garbage input all
//     throw the right errors so the UI can show a clear message
//   - The large-buffer fix from the changelog: a 1MB+ input doesn't blow the
//     call stack (the old spread-based implementation would have thrown a
//     RangeError here)
//
// Why no direct tests of bufferToBase64 / base64ToBuffer:
//   Those helpers are not exported from encrypt.js — they're internal
//   implementation details. We test them indirectly by using a large plaintext,
//   which forces both functions to process a big buffer. If they were broken,
//   the round-trip test would fail.

import { describe, it, expect } from "vitest";
import { encryptText, decryptText } from "@/lib/encrypt";

// ─── Round-trip ──────────────────────────────────────────────────────────────

describe("encryptText / decryptText round-trip", () => {
  it("decrypting with the same passphrase returns the original string", async () => {
    const original = "Hello, Sentinel!";
    const passphrase = "correct-horse-battery-staple";

    const encrypted = await encryptText(original, passphrase);
    const decrypted = await decryptText(encrypted, passphrase);

    expect(decrypted).toBe(original);
  });

  it("encrypted output starts with the sentinel:v1: prefix", async () => {
    // This doubles as a format regression test — if the output format ever
    // changes accidentally, every stored encrypted string would become
    // unreadable, so we want an early warning.
    const encrypted = await encryptText("test", "pass");
    expect(encrypted.startsWith("sentinel:v1:")).toBe(true);
  });

  it("two encryptions of the same plaintext produce different ciphertext", async () => {
    // AES-GCM uses a random salt and IV on every call. If this test ever
    // fails it means randomness was removed, which would be a serious
    // security regression — identical ciphertexts leak that two plaintexts
    // are the same.
    const a = await encryptText("same text", "same passphrase");
    const b = await encryptText("same text", "same passphrase");
    expect(a).not.toBe(b);
  });
});

// ─── Wrong passphrase ────────────────────────────────────────────────────────

describe("decryptText with a wrong passphrase", () => {
  it("throws an error with message DECRYPT_FAILED", async () => {
    const encrypted = await encryptText("secret", "correct-passphrase");

    // AES-GCM is an authenticated cipher: it detects that the key is wrong
    // and refuses to produce output, rather than decrypting to garbage.
    await expect(decryptText(encrypted, "wrong-passphrase")).rejects.toThrow(
      "DECRYPT_FAILED"
    );
  });
});

// ─── Tampered ciphertext ─────────────────────────────────────────────────────

describe("decryptText with tampered ciphertext", () => {
  it("throws DECRYPT_FAILED when one character in the ciphertext is changed", async () => {
    const encrypted = await encryptText("secret", "passphrase");

    // The ciphertext is the last colon-delimited segment. We flip one
    // character in it to simulate an attacker modifying the stored string.
    const parts = encrypted.split(":");
    const lastPart = parts[parts.length - 1];

    // Swap the first character for something different
    const tamperedChar = lastPart[0] === "A" ? "B" : "A";
    parts[parts.length - 1] = tamperedChar + lastPart.slice(1);
    const tampered = parts.join(":");

    // AES-GCM's authentication tag catches this — same error as wrong
    // passphrase, deliberately, so attackers can't tell which part failed.
    await expect(decryptText(tampered, "passphrase")).rejects.toThrow(
      "DECRYPT_FAILED"
    );
  });
});

// ─── Malformed input ─────────────────────────────────────────────────────────

describe("decryptText with malformed input", () => {
  it("throws MALFORMED when the input doesn't start with sentinel:v1:", async () => {
    await expect(decryptText("not-a-sentinel-string", "pass")).rejects.toThrow(
      "MALFORMED"
    );
  });

  it("throws MALFORMED for an empty string", async () => {
    await expect(decryptText("", "pass")).rejects.toThrow("MALFORMED");
  });

  it("throws MALFORMED when the payload has the wrong number of segments", async () => {
    // Valid prefix, but only two colon-separated fields instead of three
    await expect(
      decryptText("sentinel:v1:onlytwoparts:notthree", "pass")
    ).rejects.toThrow("MALFORMED");
  });

  it("throws MALFORMED when a base64 segment is invalid", async () => {
    // Valid structure, but the salt segment is not valid base64
    await expect(
      decryptText("sentinel:v1:!!!:aGVsbG8=:d29ybGQ=", "pass")
    ).rejects.toThrow("MALFORMED");
  });
});

// ─── Large buffer (stack-overflow regression) ─────────────────────────────────

describe("large buffer handling", () => {
  it("round-trips a 1MB+ plaintext without throwing a RangeError", async () => {
    // The old spread-based bufferToBase64 used String.fromCharCode(...array),
    // which passes every byte as a separate function argument. JS engines
    // have a call-stack argument limit (typically ~65,000–125,000). A 1MB
    // buffer is ~1,000,000 bytes, which blows that limit and throws:
    //   RangeError: Maximum call stack size exceeded
    //
    // The fixed version uses a for...of loop, which has no such limit.
    // This test catches any regression back to the spread pattern.
    const oneMegabyte = "x".repeat(1024 * 1024); // 1,048,576 characters
    const passphrase = "large-buffer-test";

    const encrypted = await encryptText(oneMegabyte, passphrase);
    const decrypted = await decryptText(encrypted, passphrase);

    expect(decrypted).toBe(oneMegabyte);
  }, 30_000); // 30s timeout — PBKDF2 at 310k iterations is intentionally slow
});
