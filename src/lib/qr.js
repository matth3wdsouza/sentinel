// qr.js — QR code decode and generate helpers.
// Decode: @zxing/browser reads from an image element directly.
// Generate: qrcode renders to a canvas element provided by the caller.
// No network calls. All processing is local.

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
// Same heuristics as clipboard.js — classify what the QR code contains
// so the explain layer can be specific.

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "mc_eid", "ref", "_hsenc", "igshid",
];

// Domains commonly used in QR phishing / redirect chains
const SUSPICIOUS_PATTERNS = [
  /bit\.ly/i, /tinyurl\.com/i, /t\.co/i, /ow\.ly/i, /rb\.gy/i,
  /cutt\.ly/i, /short\.io/i, /tiny\.cc/i, /is\.gd/i, /rebrand\.ly/i,
];

export function analyzeQRContent(text) {
  if (!text || text.trim().length === 0) {
    return { type: "empty", detail: null };
  }

  const trimmed = text.trim();

  // Prefix-based formats first: WIFI:/vCard/mailto/SMS payloads all parse as
  // URLs (they're valid schemes), so they must be classified before the
  // generic URL branch or these branches would never fire.
  if (/^WIFI:/i.test(trimmed)) {
    const ssid = trimmed.match(/S:([^;]+)/i)?.[1] ?? null;
    const password = trimmed.match(/P:([^;]+)/i)?.[1] ?? null;
    const type = trimmed.match(/T:([^;]+)/i)?.[1] ?? null;
    return { type: "wifi", detail: { ssid, password, securityType: type } };
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
