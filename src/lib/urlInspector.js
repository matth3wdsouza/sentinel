// Pure-logic URL analysis for the URL Inspector module.
// No network calls, no side effects — just parsing and heuristic checks.

// ── Constants ────────────────────────────────────────────────────────────────

const DANGER = "danger";
const WARNING = "warning";
const INFO = "info";

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "buzz", "club", "work", "info", "site", "online", "website",
  "space", "fun", "icu", "monster", "cam", "sbs", "cfd", "surf", "rest",
  "bond", "cyou", "uno", "lol",
]);

const KNOWN_BRANDS = [
  "google", "gmail", "youtube", "facebook", "meta", "instagram", "whatsapp",
  "paypal", "apple", "microsoft", "office365", "outlook", "live", "hotmail",
  "amazon", "netflix", "twitter", "x", "linkedin", "github", "dropbox",
  "icloud", "samsung", "adobe", "dhl", "fedex", "ups", "usps", "royalmail",
  "gov", "irs", "hmrc", "dwp", "nhs",
];

const SUSPICIOUS_KEYWORDS = [
  "login", "signin", "verify", "security", "account", "update", "confirm",
  "suspend", "restrict", "unusual", "activity", "alert", "urgent", "immediate",
];

// Leet-speak and common homoglyph substitutions used by typosquatters.
const LEET_MAP = {
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", "$": "s", "!": "i",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidIPv4(str) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(str);
}

function isValidIPv6(str) {
  // Covers standard, compressed, and mixed IPv6 forms that the URL
  // constructor accepts — we only need to distinguish "looks like an IP"
  // from "looks like a domain".
  if (str.includes(":") && !str.includes("%")) {
    // Simplified: if it has colons and no percent-encoding, treat as IPv6
    return true;
  }
  return false;
}

function getTLD(hostname) {
  const parts = hostname.split(".");
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function isPunycode(hostname) {
  return hostname.includes("xn--");
}

function hasNonASCII(str) {
  return /[^\x00-\x7F]/.test(str);
}

function containsEncodedChars(str) {
  // Percent-encoded characters (excluding standard path encoding like %20)
  return /%[0-9a-fA-F]{2}/.test(str);
}

function extractRawHostname(urlStr) {
  // Extract the raw hostname from the URL string before the URL constructor
  // auto-decodes percent-encoding. Matches between :// and the next /, :, ?, or #.
  const match = urlStr.match(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/([^/?#:]+)/);
  return match ? match[1] : null;
}

function decodeAll(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// Extract the registrable domain name (the part before the TLD) from a
// hostname. For "go0gle.com" → "go0gle", for "evil.google.co.uk" → "google".
function getRegistrableName(hostname) {
  const parts = hostname.split(".");
  // Ignore single-label hosts (localhost, IP literals)
  if (parts.length < 2) return null;
  // For two-part domains (example.com), take the first part.
  // For three+ part domains (www.example.co.uk), take the second-to-last
  // unless the TLD is compound — in practice, taking the second-to-last
  // part covers most phishing cases reliably enough.
  return parts[parts.length - 2].toLowerCase();
}

// Normalize a domain name for typosquatting comparison by applying
// leet-speak substitutions and stripping hyphens.
function normalizeForTyposquat(hostname) {
  const name = getRegistrableName(hostname);
  if (!name) return null;
  return name.replace(/./g, (c) => LEET_MAP[c] ?? c).replace(/-/g, "");
}

// Levenshtein edit distance — used to catch near-miss typosquats that
// aren't exact leet-speak substitutions (e.g. "gmaii" vs "gmail").
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

// ── Flag detection ───────────────────────────────────────────────────────────

function detectFlags(parsed, raw) {
  const flags = [];

  // ── Scheme ──────────────────────────────────────────────────────────────

  if (parsed.protocol === "javascript:") {
    flags.push({
      type: "javascript-uri",
      severity: DANGER,
      message: "JavaScript URI detected",
      detail:
        "This URL executes JavaScript code in the browser. Never open a javascript: link from an untrusted source.",
    });
  }

  if (parsed.protocol === "data:") {
    flags.push({
      type: "data-uri",
      severity: DANGER,
      message: "Data URI detected",
      detail:
        "This URL contains inline content (HTML, images, scripts) rather than pointing to a real resource. Data URIs can carry executable payloads.",
    });
  }

  if (parsed.protocol === "http:" && !parsed.hostname.includes("localhost")) {
    flags.push({
      type: "no-https",
      severity: WARNING,
      message: "Connection is not encrypted (HTTP)",
      detail:
        "This URL uses plain HTTP — any data sent to or from this site can be intercepted. Legitimate sites should use HTTPS.",
    });
  }

  // ── Hostname ────────────────────────────────────────────────────────────

  const hostname = parsed.hostname;

  if (isValidIPv4(hostname)) {
    flags.push({
      type: "ip-literal",
      severity: DANGER,
      message: "Hostname is an IP address",
      detail:
        "Phishing sites often use raw IP addresses instead of domain names because they can't obtain a legitimate certificate for a brand they don't own.",
    });
  }

  if (isValidIPv6(hostname)) {
    flags.push({
      type: "ip-literal",
      severity: DANGER,
      message: "Hostname is an IPv6 address",
      detail:
        "Raw IPv6 addresses are unusual for legitimate websites and are a common phishing indicator.",
    });
  }

  // Misleading subdomain check — e.g. "google.com.evil.com"
  const hostnameParts = hostname.split(".");
  if (hostnameParts.length >= 3) {
    for (const brand of KNOWN_BRANDS) {
      if (hostnameParts.includes(brand.toLowerCase())) {
        // The brand is a subdomain, not the registered domain — suspicious
        const domain = hostnameParts.slice(-2).join(".");
        if (!brand.toLowerCase().split("").every((c) => domain.includes(c))) {
          flags.push({
            type: "misleading-subdomain",
            severity: DANGER,
            message: `Misleading subdomain — "${brand}" appears as a subdomain, not the real domain`,
            detail: `The actual domain is "${domain}", not "${brand}". This is a common phishing trick: putting a trusted brand name in a subdomain to make the URL look legitimate.`,
          });
          break;
        }
      }
    }
  }

  // At-sign trick — e.g. https://google.com@evil.com
  if (parsed.username || parsed.password) {
    flags.push({
      type: "at-sign-auth",
      severity: DANGER,
      message: "Username/password embedded in URL",
      detail: `The URL contains ${parsed.username ? `a username "${decodedUsername(parsed.username)}"` : ""}${parsed.username && parsed.password ? " and " : ""}${parsed.password ? "a password" : ""} before the @. This is a classic phishing trick — the part before @ is cosmetic; the real destination is "${hostname}".`,
    });
  }

  // Punycode / internationalized domain
  if (isPunycode(hostname)) {
    flags.push({
      type: "punycode-hostname",
      severity: WARNING,
      message: "Internationalized domain name (punycode)",
      detail: `The hostname uses punycode encoding ("${hostname}"), which represents non-Latin characters. This can be used to register lookalike domains with Cyrillic or other characters that resemble Latin letters.`,
    });
  }

  if (hasNonASCII(hostname)) {
    flags.push({
      type: "non-ascii-hostname",
      severity: WARNING,
      message: "Non-ASCII characters in hostname",
      detail:
        "The hostname contains characters outside the basic Latin alphabet. This may indicate an internationalized domain used for spoofing.",
    });
  }

  // Suspicious TLD
  const tld = getTLD(hostname);
  if (SUSPICIOUS_TLDS.has(tld)) {
    flags.push({
      type: "suspicious-tld",
      severity: WARNING,
      message: `Suspicious TLD: .${tld}`,
      detail: `The top-level domain ".${tld}" is commonly associated with disposable or low-trust domains. Legitimate brands rarely use these.`,
    });
  }

  // Typosquatting — catch leet-speak substitutions (go0gle → google) and
  // near-miss spellings (gmaii → gmail, gooogle → google) in the registered
  // domain name. Only fires when the hostname isn't already an IP literal
  // or the exact legitimate brand domain.
  if (!isValidIPv4(hostname) && !isValidIPv6(hostname)) {
    const normalized = normalizeForTyposquat(hostname);
    const rawName = getRegistrableName(hostname);
    if (normalized && rawName) {
      // Skip exact matches on the real brand domain (google.com is fine)
      const isExactBrand = KNOWN_BRANDS.some((b) => rawName === b);
      if (!isExactBrand) {
        // Check for exact leet-speak match (go0gle → google)
        const leetMatch = KNOWN_BRANDS.find((b) => normalized === b);
        if (leetMatch) {
          flags.push({
            type: "typosquatting",
            severity: DANGER,
            message: `Possible typosquatting — "${rawName}" normalises to "${leetMatch}" via character substitution`,
            detail: `The domain "${rawName}" uses leet-speak or homoglyph substitutions that resolve to the brand "${leetMatch}". This is a common phishing technique to impersonate trusted brands.`,
          });
        } else {
          // Fuzzy match — edit distance 1-2 against any brand name
          const closeMatch = KNOWN_BRANDS.find((b) => {
            if (b.length <= 3) return false; // skip short brands (x, irs, ups) — too many false positives
            const dist = levenshtein(normalized, b);
            return dist >= 1 && dist <= 2 && normalized.length >= b.length - 1 && normalized.length <= b.length + 2;
          });
          if (closeMatch) {
            flags.push({
              type: "typosquatting",
              severity: WARNING,
              message: `Possible typosquatting — "${rawName}" is close to "${closeMatch}" (edit distance ${levenshtein(normalized, closeMatch)})`,
              detail: `The domain "${rawName}" is only a few characters away from the brand "${closeMatch}". Typosquatters register near-miss domains to catch users who mistype URLs.`,
            });
          }
        }
      }
    }
  }

  // Encoded characters in hostname — check the raw string, not the decoded
  // parsed.hostname, because the URL constructor auto-decodes percent-encoding.
  const rawHostname = extractRawHostname(raw);
  if (rawHostname && containsEncodedChars(rawHostname)) {
    flags.push({
      type: "encoded-hostname",
      severity: WARNING,
      message: "Encoded characters in hostname",
      detail:
        "The hostname contains percent-encoded characters, which may be hiding homoglyphs or deceptive characters.",
    });
  }

  // Non-standard port
  if (parsed.port && !["80", "443", ""].includes(parsed.port)) {
    flags.push({
      type: "non-standard-port",
      severity: INFO,
      message: `Non-standard port: ${parsed.port}`,
      detail: `This URL uses port ${parsed.port} instead of the default (80 for HTTP, 443 for HTTPS). Non-standard ports are not inherently malicious but are uncommon for legitimate sites.`,
    });
  }

  // ── Path ────────────────────────────────────────────────────────────────

  const path = parsed.pathname;
  const pathSegments = path.split("/").filter(Boolean);

  if (pathSegments.length > 6) {
    flags.push({
      type: "deep-path",
      severity: INFO,
      message: "Unusually deep path",
      detail: `The URL has ${pathSegments.length} path segments. Deep paths can be used to obscure the actual destination.`,
    });
  }

  // Encoded slashes or path traversal patterns
  if (/[.][/\\][.][/\\]/.test(path) || /%2[eE]/.test(path)) {
    flags.push({
      type: "path-traversal",
      severity: WARNING,
      message: "Possible path traversal pattern",
      detail:
        "The path contains directory traversal patterns (../), which may indicate an attempt to access files outside the intended directory.",
    });
  }

  // Encoded newlines in path (header injection vector)
  if (/%0[da]|%0d|%0a/i.test(raw)) {
    flags.push({
      type: "header-injection",
      severity: DANGER,
      message: "Encoded newline characters detected",
      detail:
        "The URL contains encoded carriage return (CR) or line feed (LF) characters, which can be used for HTTP header injection attacks.",
    });
  }

  // ── Query parameters ────────────────────────────────────────────────────

  const searchParams = parsed.searchParams;
  const rawQueryString = raw.includes("?") ? raw.split("?").slice(1).join("?").split("#")[0] : "";
  const suspiciousParams = [];

  for (const [key, value] of searchParams) {
    // Check for base64-encoded payloads in query params
    if (/[A-Za-z0-9+/]{20,}={0,2}/.test(value)) {
      suspiciousParams.push({ key, reason: "possible base64 payload" });
    }
    // Check for encoded URLs in query params (open redirect vector)
    // Use the raw query string since URL constructor auto-decodes values
    if (/%2[Ff]|%2f/i.test(rawQueryString) && /https?/i.test(value)) {
      suspiciousParams.push({ key, reason: "encoded URL (possible open redirect)" });
    }
    // Check for javascript: in query params
    if (/javascript:/i.test(value)) {
      suspiciousParams.push({ key, reason: "JavaScript URI in parameter" });
    }
  }

  if (suspiciousParams.length > 0) {
    flags.push({
      type: "suspicious-query-params",
      severity: WARNING,
      message: "Suspicious query parameters detected",
      detail:
        suspiciousParams
          .map((p) => `"${p.key}" — ${p.reason}`)
          .join("; "),
    });
  }

  // ── Overall URL heuristics ──────────────────────────────────────────────

  if (raw.length > 2000) {
    flags.push({
      type: "very-long-url",
      severity: INFO,
      message: "Very long URL",
      detail:
        "Extremely long URLs can be used to hide the real destination or overflow security tools' display limits.",
    });
  }

  return flags;
}

function decodedUsername(u) {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────

function computeVerdict(flags) {
  const hasDanger = flags.some((f) => f.severity === DANGER);
  const hasWarning = flags.some((f) => f.severity === WARNING);

  if (hasDanger) return "dangerous";
  if (hasWarning) return "suspicious";
  return "safe";
}

// ── Public API ───────────────────────────────────────────────────────────────

export function analyzeURL(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const flags = detectFlags(parsed, trimmed);
  const verdict = computeVerdict(flags);

  return { parsed, flags, verdict };
}

// Exported for testing only
export { SUSPICIOUS_TLDS, KNOWN_BRANDS, DANGER, WARNING, INFO };
