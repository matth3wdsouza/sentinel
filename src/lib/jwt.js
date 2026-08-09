// jwt.js — JWT parsing and time-formatting helpers.
// Pure logic for the JWT Inspector module.

// Decode a single Base64url segment → parsed object.
// JWT segments use Base64url (- and _ instead of + and /, no padding).
export function decodeSegment(segment) {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export function parseJWT(token) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("MALFORMED");

  let header, payload;
  try {
    header = decodeSegment(parts[0]);
  } catch {
    throw new Error("BAD_HEADER");
  }
  try {
    payload = decodeSegment(parts[1]);
  } catch {
    throw new Error("BAD_PAYLOAD");
  }

  return { header, payload, signature: parts[2] };
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function formatTimestamp(unix) {
  if (!Number.isFinite(unix)) return "n/a";
  const date = new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function relativeTime(unix) {
  if (!Number.isFinite(unix)) return "n/a";
  const diffMs = unix * 1000 - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return diffSec >= 0 ? "in a few seconds" : "a few seconds ago";
  const mins = Math.round(abs / 60);
  if (abs < 3600) return diffSec >= 0 ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(abs / 3600);
  if (abs < 86400) return diffSec >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(abs / 86400);
  return diffSec >= 0 ? `in ${days}d` : `${days}d ago`;
}
