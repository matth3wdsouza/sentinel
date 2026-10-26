// Text encryption and decryption using Web Crypto API.
//
// Primitives:
//   - Key derivation: PBKDF2 (SHA-256). New ciphertext uses 600,000 iterations,
//     the current OWASP guidance. Legacy v1 ciphertext uses 310,000 iterations.
//   - Encryption:     AES-256-GCM (authenticated, detects tampering automatically)
//   - Salt:           16 bytes, random per encryption (prevents rainbow-table attacks)
//   - IV:             12 bytes, random per encryption (required for GCM security)
//
// Output format (v2):
//   sentinel:v2:<iterations>:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>
//
// Legacy input (read-only):
//   sentinel:v1:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>
//   v1 ciphertext was always derived with 310,000 iterations.
//
// The iteration count is part of the v2 string so that it can be raised again
// without making earlier ciphertext unreadable. The salt, IV, and ciphertext are
// bundled together so the decrypt side only needs the passphrase and this string.
//
// The format is Sentinel-specific (the colon-delimited packing), but the
// underlying crypto is standard AES-256-GCM + PBKDF2. Any tool that supports
// those primitives can decrypt the payload after parsing the fields.

const SENTINEL_PREFIX = "sentinel:";
const VERSION_V1 = "v1";
const VERSION_V2 = "v2";
const CURRENT_ITERATIONS = 600_000;
const LEGACY_V1_ITERATIONS = 310_000;
const SALT_BYTES = 16; // 128-bit salt
const IV_BYTES = 12;   // 96-bit IV, standard for AES-GCM
const GCM_TAG_BYTES = 16;

// Bounds on the iteration count read from a v2 string. The upper bound stops a
// crafted string from turning decryption into an expensive denial-of-service.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;

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

function parseIterations(raw) {
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error("MALFORMED");
  }

  const iterations = Number(raw);
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < MIN_ITERATIONS ||
    iterations > MAX_ITERATIONS
  ) {
    throw new Error("MALFORMED");
  }

  return iterations;
}

// Derives a 256-bit AES-GCM key from a passphrase + salt using PBKDF2.
async function deriveKey(passphrase, saltBuffer, iterations) {
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
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,            // not extractable, key never leaves Web Crypto
    ["encrypt", "decrypt"]
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with a passphrase.
 *
 * Returns a self-contained string in the format:
 *   sentinel:v2:<iterations>:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>
 *
 * Throws if Web Crypto is unavailable or encryption fails for any reason.
 */
export async function encryptText(plaintext, passphrase) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const key = await deriveKey(passphrase, salt.buffer, CURRENT_ITERATIONS);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const b64Salt = bufferToBase64(salt.buffer);
  const b64Iv = bufferToBase64(iv.buffer);
  const b64Ciphertext = bufferToBase64(ciphertextBuffer);

  return `${SENTINEL_PREFIX}${VERSION_V2}:${CURRENT_ITERATIONS}:${b64Salt}:${b64Iv}:${b64Ciphertext}`;
}

/**
 * Decrypts a sentinel:v2:... or legacy sentinel:v1:... string to plaintext.
 *
 * Throws with a descriptive message on:
 *   - Malformed input, including bad field counts, bad base64, wrong salt/IV
 *     lengths, and iteration counts outside the supported range
 *   - An unsupported format version
 *   - Wrong passphrase or tampered ciphertext (AES-GCM authentication failure)
 */
export async function decryptText(encryptedString, passphrase) {
  // ── Parse version and payload ────────────────────────────────────────────
  if (
    typeof encryptedString !== "string" ||
    !encryptedString.startsWith(SENTINEL_PREFIX)
  ) {
    throw new Error("MALFORMED");
  }

  const withoutPrefix = encryptedString.slice(SENTINEL_PREFIX.length);
  const versionSeparator = withoutPrefix.indexOf(":");

  if (versionSeparator === -1) {
    throw new Error("MALFORMED");
  }

  const version = withoutPrefix.slice(0, versionSeparator);
  const payload = withoutPrefix.slice(versionSeparator + 1);

  if (!version) {
    throw new Error("MALFORMED");
  }

  let iterations;
  let expectedParts;

  if (version === VERSION_V1) {
    iterations = LEGACY_V1_ITERATIONS;
    expectedParts = 3;
  } else if (version === VERSION_V2) {
    expectedParts = 4;
  } else {
    throw new Error("UNSUPPORTED_VERSION");
  }

  const parts = payload.split(":");
  if (parts.length !== expectedParts) {
    throw new Error("MALFORMED");
  }

  let b64Salt, b64Iv, b64Ciphertext;

  if (version === VERSION_V1) {
    [b64Salt, b64Iv, b64Ciphertext] = parts;
  } else {
    const [rawIterations, ...rest] = parts;
    iterations = parseIterations(rawIterations);
    [b64Salt, b64Iv, b64Ciphertext] = rest;
  }

  let saltBuffer, ivBuffer, ciphertextBuffer;
  try {
    saltBuffer = base64ToBuffer(b64Salt);
    ivBuffer = base64ToBuffer(b64Iv);
    ciphertextBuffer = base64ToBuffer(b64Ciphertext);
  } catch {
    throw new Error("MALFORMED");
  }

  if (
    saltBuffer.byteLength !== SALT_BYTES ||
    ivBuffer.byteLength !== IV_BYTES ||
    ciphertextBuffer.byteLength < GCM_TAG_BYTES
  ) {
    throw new Error("MALFORMED");
  }

  // ── Decrypt ──────────────────────────────────────────────────────────────
  const key = await deriveKey(passphrase, saltBuffer, iterations);

  let plaintextBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      key,
      ciphertextBuffer
    );
  } catch {
    // AES-GCM throws generically on authentication failure. It deliberately
    // doesn't distinguish "wrong passphrase" from "tampered ciphertext" to
    // avoid giving an attacker information about which part failed.
    throw new Error("DECRYPT_FAILED");
  }

  return new TextDecoder().decode(plaintextBuffer);
}
