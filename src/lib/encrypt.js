// Text encryption and decryption using Web Crypto API.
//
// Primitives:
//   - Key derivation: PBKDF2 (SHA-256, 310,000 iterations) — OWASP 2023 recommendation
//   - Encryption:     AES-256-GCM (authenticated — detects tampering automatically)
//   - Salt:           16 bytes, random per encryption (prevents rainbow-table attacks)
//   - IV:             12 bytes, random per encryption (required for GCM security)
//
// Output format:
//   sentinel:v1:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>
//
// The salt, IV, and ciphertext are bundled together so the decrypt side only
// needs the passphrase and this string — no separate key management.
//
// The format is Sentinel-specific (the colon-delimited packing), but the
// underlying crypto is standard AES-256-GCM + PBKDF2. Any tool that supports
// those primitives can decrypt the payload by parsing the four fields.

const SENTINEL_PREFIX = "sentinel:v1:";
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16; // 128-bit salt
const IV_BYTES = 12;   // 96-bit IV — standard for AES-GCM

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derives a 256-bit AES-GCM key from a passphrase + salt using PBKDF2.
async function deriveKey(passphrase, saltBuffer) {
  const encoder = new TextEncoder();

  // Import the raw passphrase bytes as a PBKDF2 key handle.
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,            // not extractable
    ["deriveKey"]
  );

  // Derive the actual AES-GCM key.
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,            // not extractable — key never leaves Web Crypto
    ["encrypt", "decrypt"]
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with a passphrase.
 *
 * Returns a self-contained string in the format:
 *   sentinel:v1:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>
 *
 * Throws if Web Crypto is unavailable or encryption fails for any reason.
 */
export async function encryptText(plaintext, passphrase) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const key = await deriveKey(passphrase, salt.buffer);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const b64Salt = bufferToBase64(salt.buffer);
  const b64Iv = bufferToBase64(iv.buffer);
  const b64Ciphertext = bufferToBase64(ciphertextBuffer);

  return `${SENTINEL_PREFIX}${b64Salt}:${b64Iv}:${b64Ciphertext}`;
}

/**
 * Decrypts a sentinel:v1:... string back to plaintext.
 *
 * Throws with a descriptive message on:
 *   - Malformed input (not a sentinel:v1: string, or wrong field count)
 *   - Wrong passphrase or tampered ciphertext (AES-GCM authentication failure)
 */
export async function decryptText(encryptedString, passphrase) {
  // ── Parse ────────────────────────────────────────────────────────────────
  if (!encryptedString.startsWith(SENTINEL_PREFIX)) {
    throw new Error("MALFORMED");
  }

  const payload = encryptedString.slice(SENTINEL_PREFIX.length);
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error("MALFORMED");
  }

  const [b64Salt, b64Iv, b64Ciphertext] = parts;

  let saltBuffer, ivBuffer, ciphertextBuffer;
  try {
    saltBuffer = base64ToBuffer(b64Salt);
    ivBuffer = base64ToBuffer(b64Iv);
    ciphertextBuffer = base64ToBuffer(b64Ciphertext);
  } catch {
    throw new Error("MALFORMED");
  }

  // ── Decrypt ──────────────────────────────────────────────────────────────
  const key = await deriveKey(passphrase, saltBuffer);

  let plaintextBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      key,
      ciphertextBuffer
    );
  } catch {
    // AES-GCM throws generically on authentication failure — it deliberately
    // doesn't distinguish "wrong passphrase" from "tampered ciphertext" to
    // avoid giving an attacker information about which part failed.
    throw new Error("DECRYPT_FAILED");
  }

  return new TextDecoder().decode(plaintextBuffer);
}
