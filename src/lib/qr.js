// qr.js — QR code decode and generate helpers.
// Decode: @zxing/browser reads from an image element directly.
// Generate: qrcode renders to a canvas element provided by the caller.
// No network calls. All processing is local.

import { TRACKING_PARAMS } from "@/lib/urlSignals";

// ─── Decode ───────────────────────────────────────────────────────────────────

export async function decodeQR(file) {
  try {
    // Validate the file actually decodes as an image. Without this,
    // @zxing/browser waits out its 10s image-load timeout on corrupt uploads
    // and reports LIBRARY_ERROR, which is misleading.
    if (typeof createImageBitmap === "function") {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch (_) {
        return { error: "IMAGE_ERROR", data: null };
      }
      bitmap.close();
    }

    const { BrowserQRCodeReader } = await import("@zxing/browser");
    const reader = new BrowserQRCodeReader();

    const url = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      return { error: null, data: result.getText() };
    } catch (err) {
      URL.revokeObjectURL(url);
      const isNotFound =
        err?.name === "NotFoundException" ||
        err?.message?.includes("No MultiFormat Readers") ||
        err?.message?.includes("No code detected");
      return { error: isNotFound ? "NOT_FOUND" : "LIBRARY_ERROR", data: null };
    }
  } catch (err) {
    return { error: "LIBRARY_ERROR", data: null };
  }
}

// ─── Generate ─────────────────────────────────────────────────────────────────
// Renders a QR code into the provided canvas element.
// Returns { error } — null on success.

export async function generateQR(canvas, text, { darkColor = "#223142", lightColor = "#ffffff", errorCorrectionLevel = "M" } = {}) {
  try {
    const QRCode = await import("qrcode");
    await QRCode.toCanvas(canvas, text, {
      width: 280,
      margin: 2,
      color: { dark: darkColor, light: lightColor },
      errorCorrectionLevel,
    });
    return { error: null };
  } catch (err) {
    return { error: err.message ?? "GENERATE_ERROR" };
  }
}

// ─── Content analysis ─────────────────────────────────────────────────────────
// Same heuristics as clipboard.js (shared TRACKING_PARAMS from urlSignals) —
// classify what the QR code contains so the explain layer can be specific.

// Domains commonly used in QR phishing / redirect chains
const SUSPICIOUS_PATTERNS = [
  /bit\.ly/i, /tinyurl\.com/i, /t\.co/i, /ow\.ly/i, /rb\.gy/i,
  /cutt\.ly/i, /short\.io/i, /tiny\.cc/i, /is\.gd/i, /rebrand\.ly/i,
];

// Parse a WIFI: payload into its fields, respecting backslash escapes. The
// app's generator escapes `\`, `;`, `,`, `:` and `"` per the WiFi-QR
// convention, so a naive `S:([^;]+)` regex would stop at the first semicolon —
// including an escaped one — and silently truncate the SSID/password. The
// tokenizer walks the string, recording a value up to the first *unescaped*
// `;` and unescaping the result.
function parseWifiPayload(text) {
  const detail = { ssid: null, password: null, securityType: null };
  // Points just past the "WIFI:" prefix (5 chars; safe for case-insensitive
  // input because "wifi:" is the same length).
  let i = 5;

  while (i < text.length) {
    // Tolerate stray separators — the generator emits one trailing ";" per
    // field, so the payload ends with a dangling ";".
    while (text[i] === ";") i += 1;
    if (i >= text.length) break;

    const key = text[i];
    // Field keys are single letters followed by ":". Stop when the structure
    // breaks down rather than guessing at the rest of a malformed payload.
    if (text[i + 1] !== ":") break;
    i += 2;

    let value = "";
    while (i < text.length) {
      const c = text[i];
      if (c === "\\") {
        // Backslash escapes the next character — keep it literally.
        value += text[i + 1] ?? "";
        i += 2;
      } else if (c === ";") {
        i += 1;
        break;
      } else {
        value += c;
        i += 1;
      }
    }

    const k = key.toLowerCase();
    const v = value === "" ? null : value;
    if (k === "s") detail.ssid = v;
    else if (k === "p") detail.password = v;
    else if (k === "t") detail.securityType = v;
    // H (hidden) is intentionally not captured, matching the previous regex.
  }
  return detail;
}

export function analyzeQRContent(text) {
  if (!text || text.trim().length === 0) {
    return { type: "empty", detail: null };
  }

  const trimmed = text.trim();

  // Prefix-based formats first: WIFI:/vCard/mailto/SMS payloads all parse as
  // URLs (they're valid schemes), so they must be classified before the
  // generic URL branch or these branches would never fire.
  if (/^WIFI:/i.test(trimmed)) {
    return { type: "wifi", detail: parseWifiPayload(trimmed) };
  }

  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const name = trimmed.match(/FN:(.+)/i)?.[1]?.trim() ?? null;
    return { type: "vcard", detail: { name } };
  }

  if (/^mailto:/i.test(trimmed)) {
    return { type: "mailto", detail: { value: trimmed.slice(7) } };
  }

  // SMS — accept "sms:" and "smsto:" prefixes (and nothing else: "smst:" is
  // not a real scheme and must not match)
  if (/^(sms|smsto):/i.test(trimmed)) {
    return { type: "sms", detail: null };
  }

  // URL
  try {
    const url = new URL(trimmed);
    // Only http/https are navigable web links. Anything else that parses as
    // a URL (javascript:, data:, file:, …) is thrown out so it falls through
    // to the plain-text branch below — the Decode tab must never render a
    // clickable "Open" link for a non-web scheme, and shouldn't label one a
    // normal URL either. (mailto: and sms: are handled by their own branches
    // above and never reach this check.)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError("non-navigable scheme");
    }
    const trackingParams = TRACKING_PARAMS.filter((p) =>
      url.searchParams.has(p)
    );
    const isShortener = SUSPICIOUS_PATTERNS.some((re) => re.test(url.hostname));
    const isHttps = url.protocol === "https:";
    const isHttp = url.protocol === "http:";

    return {
      type: "url",
      detail: {
        href: trimmed,
        domain: url.hostname,
        protocol: url.protocol,
        trackingParams,
        isShortener,
        isHttps,
        isHttp,
        // Individual URL components, keyed to the URL object's own
        // properties so the shared URLPartsTable can render/copy them.
        parts: {
          protocol: url.protocol,
          username: url.username,
          password: url.password,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
        },
        // Strip tracking params for the "safe" version to show user
        cleanUrl: (() => {
          const u = new URL(trimmed);
          trackingParams.forEach((p) => u.searchParams.delete(p));
          return u.toString();
        })(),
      },
    };
  } catch (_) {
    // not a URL
  }

  // Plain text / other
  return { type: "text", detail: { length: trimmed.length } };
}
