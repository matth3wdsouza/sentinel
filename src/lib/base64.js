// base64.js — Base64 / Base64url encoding helpers.
// Pure logic for the Base64 module.

// Standard Base64 uses + and / with = padding.
// Base64url (RFC 4648 §5) uses - and _ instead, and omits padding —
// used in JWTs, URL query params, and browser APIs like crypto.subtle.
export function toBase64(str, urlSafe) {
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  const b64 = btoa(binary);
  return urlSafe
    ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : b64;
}

export function fromBase64(str, urlSafe) {
  // Normalise Base64url → standard before decoding.
  let b64 = urlSafe
    ? str.replace(/-/g, "+").replace(/_/g, "/")
    : str;
  // Re-add stripped padding if needed.
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";

  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
