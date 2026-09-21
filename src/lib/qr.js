// qr.js — QR code decode and generate helpers.
// Decode: native BarcodeDetector when available, else @zxing/browser reading
// from a cross-origin-capable image URL. Generate: qrcode renders to a canvas
// element provided by the caller. No network calls. All processing is local.

import { TRACKING_PARAMS } from "@/lib/urlSignals";
import { parseTOTP } from "@/lib/totp";

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

    // Prefer the browser's native QR decoder (Chromium, Android Chrome) — it
    // uses the OS's own barcode engine rather than a JS reimplementation and
    // reads photographed codes (angled, uneven lighting) far more reliably.
    // Not every engine accepts a Blob here, and returns-with-no-results are
    // genuinely missed codes, so both cases fall through to @zxing/browser
    // rather than reporting failure twice.
    if (typeof BarcodeDetector !== "undefined") {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const detected = await detector.detect(file);
        if (detected.length > 0) {
          return { error: null, data: detected[0].rawValue };
        }
      } catch (_) {
        // Fall through to the @zxing/browser path.
      }
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
      // Any failure here is a decode miss, not a load failure. The only paths
      // that can actually fail to load — importing the chunk and constructing
      // the reader — sit above this inner try and fall through to the outer
      // catch (LIBRARY_ERROR). zxing throws many differently-named exceptions
      // (NotFoundException, ChecksumException, FormatException, ...) on a hard
      // image, and distinguishing them buys nothing: every decode miss is
      // reported as NOT_FOUND so the Decode tab can give photo-taking advice.
      return { error: "NOT_FOUND", data: null };
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

// Parse a UPI "upi://pay" payload (NPCI deep-link standard) into its fields.
// pa (payee VPA) and pn (payee name) are required; am/cu/tn/tr/mc/mode are
// optional. Values are percent-encoded and decoded via URLSearchParams. The
// `sign` field (a PSP-issued signature over the payload) is reduced to a
// boolean — the signature bytes are noise in a read-only inspector and are
// never surfaced. A payload is `malformed` when the VPA doesn't look like
// name@handle or an embedded amount isn't a plain decimal.
function parseUpiPayload(text) {
  const query = text.slice(text.indexOf("?") + 1);
  const params = new URLSearchParams(query);

  const detail = {
    payeeVpa: params.get("pa") ?? null,
    payeeName: params.get("pn") ?? null,
    amount: params.get("am") ?? null,
    currency: params.get("cu") ?? null,
    note: params.get("tn") ?? null,
    reference: params.get("tr") ?? null,
    merchantCode: params.get("mc") ?? null,
    mode: params.get("mode") ?? null,
    hasAmount: params.get("am") !== null,
    hasSignature: params.get("sign") !== null,
  };

  const vpaOk =
    detail.payeeVpa !== null &&
    /^[^@\s]{2,256}@[^@\s]{2,64}$/.test(detail.payeeVpa);
  const amountOk = detail.amount === null || /^\d+(\.\d{1,2})?$/.test(detail.amount);
  detail.malformed = !(vpaOk && amountOk);

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

  // TOTP setup (2FA) URIs — otpauth://totp/... parse as URLs with a non-web
  // scheme, so the URL branch below would silently drop them to plain text.
  // Recognised here so the Decode tab can point at the TOTP module. Only the
  // coarse account/configuration fields are surfaced — the shared secret is
  // never included.
  if (/^otpauth:/i.test(trimmed)) {
    try {
      const totp = parseTOTP(trimmed);
      return {
        type: "otpauth",
        detail: {
          issuer: totp.issuer || null,
          account: totp.label || null,
          period: totp.period,
          digits: totp.digits,
        },
      };
    } catch (_) {
      // Not a parseable TOTP URI (e.g. otpauth://hotp or a malformed URI) —
      // fall through to the URL/text branches.
    }
  }

  // UPI payment requests — upi://pay is the NPCI-standard deep link behind
  // payment QR codes. Like otpauth it parses as a URL with a non-web scheme,
  // so it must be recognised here before the URL branch throws it out.
  if (/^upi:\/\/pay/i.test(trimmed)) {
    const detail = parseUpiPayload(trimmed);
    // Only treat it as a payment code when the essential field (the payee
    // address) is present — a bare "upi://pay" with nothing else is not a
    // usable payment code and falls through to plain text.
    if (detail.payeeVpa !== null) {
      return { type: "upi", detail };
    }
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
