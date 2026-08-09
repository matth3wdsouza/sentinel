// clipboard.js — Clipboard read/write helpers and content analysis.
// All processing is local. The clipboard value is never stored or logged.

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function readClipboard() {
  try {
    if (!navigator.clipboard?.readText) {
      return { error: "NOT_SUPPORTED", value: null };
    }
    const value = await navigator.clipboard.readText();
    return { error: null, value };
  } catch (err) {
    const code =
      err.name === "NotAllowedError" ? "DENIED"
      : err.name === "SecurityError" ? "DENIED"
      : "ERROR";
    return { error: code, value: null };
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function writeClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) {
      return { error: "NOT_SUPPORTED" };
    }
    await navigator.clipboard.writeText(text);
    return { error: null };
  } catch (err) {
    return { error: "ERROR" };
  }
}

// ─── Content analysis ─────────────────────────────────────────────────────────
// Heuristic classification of clipboard content. Returns a { type, detail }
// object used to drive the explain layer. These are best-effort guesses, not
// definitive detections — the UI makes that clear.

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "mc_eid", "ref", "_hsenc", "igshid",
];

export function analyzeContent(text) {
  if (!text || text.trim().length === 0) {
    return { type: "empty", detail: null };
  }

  const trimmed = text.trim();

  // URL
  try {
    const url = new URL(trimmed);
    const trackingFound = TRACKING_PARAMS.filter((p) =>
      url.searchParams.has(p)
    );
    return {
      type: "url",
      detail: {
        href: trimmed,
        domain: url.hostname,
        trackingParams: trackingFound,
        isHttps: url.protocol === "https:",
      },
    };
  } catch (_) {
    // not a URL
  }

  // Card number — 13–19 digits, optionally space/dash separated
  const cardCandidate = trimmed.replace(/[\s-]/g, "");
  if (/^\d{13,19}$/.test(cardCandidate)) {
    return { type: "card", detail: { digits: cardCandidate.length } };
  }

  // Looks like a private key or long token
  if (/^[A-Za-z0-9+/=]{40,}$/.test(trimmed) && !trimmed.includes(" ")) {
    return { type: "token", detail: { length: trimmed.length } };
  }

  // Looks like a password — mixed chars, no spaces, reasonable length
  if (
    trimmed.length >= 8 &&
    trimmed.length <= 128 &&
    !trimmed.includes(" ") &&
    /[A-Z]/.test(trimmed) &&
    /[a-z]/.test(trimmed) &&
    /[\d!@#$%^&*()_+\-=[\]{}|;':",.<>?/\\`~]/.test(trimmed)
  ) {
    return { type: "password", detail: { length: trimmed.length } };
  }

  // Email address
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { type: "email", detail: { value: trimmed } };
  }

  // Phone number — 7–15 digits with optional punctuation
  const phoneCandidate = trimmed.replace(/[\s\-().+]/g, "");
  if (/^\d{7,15}$/.test(phoneCandidate)) {
    return { type: "phone", detail: null };
  }

  // Multiline / long text
  if (trimmed.includes("\n") || trimmed.length > 200) {
    const lines = trimmed.split("\n").length;
    return { type: "text", detail: { lines, length: trimmed.length } };
  }

  return { type: "text", detail: { lines: 1, length: trimmed.length } };
}
