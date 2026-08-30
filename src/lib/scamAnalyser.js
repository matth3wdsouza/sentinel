// Scam Message Analyser — pure text-scoring logic.
//
// Scans pasted SMS/email/message text for the recurring hallmarks of
// text-message scams (smishing) and groups them into severity-weighted
// categories: urgency, financial pressure, credential/OTP requests, secrecy
// pressure, impersonation, suspicious links, and pressure-grammar tells.
//
// This is a heuristic, evidence-not-verdicts tool: it surfaces indicators so
// a person can decide, it does not (and cannot) prove a message is a scam.
// Everything runs locally on the pasted string — no content is ever logged
// or transmitted, and no links are ever followed or resolved.

import { DANGER, WARNING, INFO, computeVerdict } from "@/lib/severity";
import { SUSPICIOUS_TLDS } from "@/lib/urlSignals";

// Re-exported so the existing tests/consumers keep importing from here.
export { DANGER, WARNING, INFO };

// The category order controls how flags render in the breakdown (dangerous
// and high-signal categories first).
export const CATEGORY_ORDER = [
  "credential",
  "financial",
  "secrecy",
  "links",
  "urgency",
  "impersonation",
  "pressure",
];

export const CATEGORY_CONFIG = {
  credential: { label: "Credential/OTP request", severity: DANGER },
  financial: { label: "Financial pressure", severity: DANGER },
  secrecy: { label: "Secrecy pressure", severity: DANGER },
  links: { label: "Suspicious link", severity: WARNING },
  urgency: { label: "Urgency", severity: WARNING },
  impersonation: { label: "Impersonation", severity: WARNING },
  pressure: { label: "Pressure grammar", severity: INFO },
};

// ── Heuristic tables ────────────────────────────────────────────────────────

// Surfaces scammers claim to be from — bank / courier / government / tech.
const IMPERSONATED_ENTITIES = [
  "bank", "paypal", "venmo", "cashapp", "revolut", "card", "visa",
  "mastercard", "netflix", "amazon", "apple", "microsoft", "google",
  "whatsapp", "instagram", "facebook", "operator", "service",
  "irs", "hmrc", "gov", "government", "authority", "tax", "police",
  "dhl", "fedex", "ups", "usps", "royalmail", "dpd", "postal", "courier",
  "delivery", "parcel", "toll", "supervisor", "hr", "payroll", "ceo",
  "support", "helpdesk",
];

// Urgency / time-pressure language.
const URGENCY_PHRASES = [
  "urgent", "immediately", "asap", "right away", "act now", "act fast",
  "limited time", "expires", "expiring", "before it's too late",
  "don't delay", "hurry", "final notice", "final warning", "last chance",
  "within 24 hours", "within 12 hours", "today only", "respond now",
  "immediate action", "urgently required", "time sensitive", "deadline",
];

// Credential / OTP / verification requests.
const CREDENTIAL_PHRASES = [
  "otp", "one-time password", "verification code", "verify your",
  "confirm your", "confirm your identity", "verify account", "secure your",
  "secure your account", "login", "sign in", "update your details",
  "update your payment", "re-enter", "re enter", "kyc", "kyc update",
  "confirm your details", "send the code", "send me the code", "share the code",
  "your account has been suspended", "your account will be suspended",
  "your account has been locked", "your account will be locked",
  "your account has been blocked", "your account has been limited",
  "unusual activity", "suspicious login", "fraud alert", "verify to activate",
  "click to verify", "password expired", "reset your password",
];

// Financial pressure — money, fees, fines, prizes and unusual payment methods.
const FINANCIAL_PHRASES = [
  "pay immediately", "pay now", "outstanding balance", "unpaid", "overdue",
  "late fee", "penalty", "fine", "fee", "charge", "invoice", "bill",
  "payment required", "you owe", "refund", "credited", "you've won",
  "you have won", "prize", "lottery", "gift card", "giftcard", "voucher",
  "wire transfer", "bank transfer", "crypto", "bitcoin", "cryptocurrency",
  "western union", "moneygram", "gift cards", "redeem", "deposit",
  "withdrawal", "salary", "raise", "bonus", "rebate", "cashback",
  "reward", "claim", "claim your", "tax refund", "reimbursement",
];

// Secrecy / isolation pressure.
const SECRECY_PHRASES = [
  "don't tell anyone", "do not tell anyone", "keep this between us",
  "keep this secret", "don't share this", "only you", "tell no one",
  "keep it quiet", "confidential", "don't contact", "don't call",
  "ignore", "don't inform", "between us",
];

// Pressure grammar (all-caps / exclamation-dense text) is detected inline.

const SHORTENER_DOMAINS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "bl.ink", "cutt.ly", "rebrand.ly", "shorturl.at", "tiny.cc", "snip.ly",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

// Match a phrase list against a lowercased string. Returns the matched phrases.
function findPhrases(lowerText, phrases) {
  return phrases.filter((p) => lowerText.includes(p));
}

function extractUrls(text) {
  // Loose URL matcher that catches http(s)://, www., and bare domains.
  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>"'(){}]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'(){}]*)?/gi;
  const matches = text.match(pattern) || [];
  return matches.map((u) => u.replace(/[.,;:!?]+$/, ""));
}

// Registrable-ish hostname from a URL string (the part before the first /, :, ?).
function hostOf(url) {
  const cleaned = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const match = cleaned.match(/^[^/?#:]+/);
  return match ? match[0].toLowerCase() : "";
}

function domainName(host) {
  const parts = host.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : host;
}

// Flag a URL as suspicious if it's on a known shortener or sits on an unusual
// TLD that's vanishingly rare for the entities commonly impersonated.
function urlIsSuspicious(url) {
  const host = hostOf(url);
  if (!host) return false;
  if (SHORTENER_DOMAINS.some((s) => host === s || host.endsWith("." + s))) {
    return true;
  }
  const tld = host.split(".").pop();
  return SUSPICIOUS_TLDS.has(tld);
}

// ── Flag detection ──────────────────────────────────────────────────────────

function detectFlags(text, lowerText) {
  const flags = [];
  const counts = {
    urgency: 0,
    financial: 0,
    credential: 0,
    secrecy: 0,
    impersonation: 0,
    links: 0,
    pressure: 0,
  };

  const urgencyHits = findPhrases(lowerText, URGENCY_PHRASES);
  if (urgencyHits.length > 0) {
    counts.urgency = urgencyHits.length;
    flags.push({
      id: "urgency",
      category: "urgency",
      severity: WARNING,
      message: "Urgency language",
      detail:
        `The message uses pressure language like “${urgencyHits[0]}”. ` +
        "Scammers manufacture deadlines to make you act before you can verify. " +
        "Legitimate organisations rarely demand an instant response.",
    });
  }

  const credentialHits = findPhrases(lowerText, CREDENTIAL_PHRASES);
  if (credentialHits.length > 0) {
    counts.credential = credentialHits.length;
    flags.push({
      id: "credential",
      category: "credential",
      severity: DANGER,
      message: "Asks for codes or account details",
      detail:
        `The message asks for verification (“${credentialHits[0]}”). ` +
        "Real services never ask you to send a one-time code or re-enter " +
        "credentials via a text message.",
    });
  }

  const financialHits = findPhrases(lowerText, FINANCIAL_PHRASES);
  if (financialHits.length > 0) {
    counts.financial = financialHits.length;
    flags.push({
      id: "financial",
      category: "financial",
      severity: DANGER,
      message: "Financial pressure",
      detail:
        `The message leans on money (“${financialHits[0]}”). Requests for ` +
        "immediate fees, fines, gift-card/wire/crypto payment, or “you've won” " +
        "offers are core scam patterns.",
    });
  }

  const secrecyHits = findPhrases(lowerText, SECRECY_PHRASES);
  if (secrecyHits.length > 0) {
    counts.secrecy = secrecyHits.length;
    flags.push({
      id: "secrecy",
      category: "secrecy",
      severity: DANGER,
      message: "Secrecy pressure",
      detail:
        `The message asks you to keep it quiet (“${secrecyHits[0]}”). ` +
        "Scammers isolate you so you won't check with someone who'd spot the trick.",
    });
  }

  const impersonationHits = findPhrases(lowerText, IMPERSONATED_ENTITIES);
  if (impersonationHits.length > 0) {
    counts.impersonation = impersonationHits.length;
    flags.push({
      id: "impersonation",
      category: "impersonation",
      severity: WARNING,
      message: "Claims to be a trusted entity",
      detail:
        `The message claims to be from “${impersonationHits[0]}”. Impersonating ` +
        "banks, couriers, government bodies, or trusted brands is the most common " +
        "scam frame. Always verify through official channels, never the number or " +
        "link in the message.",
    });
  }

  const urls = extractUrls(text);
  const suspiciousUrls = urls.filter(urlIsSuspicious);
  if (urls.length > 0) {
    counts.links = suspiciousUrls.length;
    flags.push({
      id: "links",
      category: "links",
      severity: suspiciousUrls.length > 0 ? WARNING : INFO,
      message: suspiciousUrls.length > 0
        ? `Message contains a suspicious link`
        : "Message contains a link",
      detail: suspiciousUrls.length > 0
        ? "The message links to a URL shortener or an unusual domain. Shortened and " +
          "lookalike links are a hallmark of smishing — don't tap it; copy the " +
          "destination and check it with the URL Inspector first."
        : "The message contains a link. Inspect it with the URL Inspector before " +
          "following it — the displayed domain can differ from the real destination.",
    });
  }

  const capCount = (text.match(/[A-Z]{3,}/g) || []).length;
  const exclaimCount = (text.match(/!{2,}/g) || []).length;
  if (capCount >= 2 || exclaimCount >= 1) {
    counts.pressure = (capCount >= 2 ? 1 : 0) + (exclaimCount >= 1 ? 1 : 0);
    flags.push({
      id: "pressure",
      category: "pressure",
      severity: INFO,
      message: "Pressure grammar",
      detail:
        "All-caps or over-punctuated text can be a tell that the writer is " +
        "pushing emotion over information. Weak on its own, but worth laying " +
        "beside the other indicators.",
    });
  }

  return { flags, counts, urls, suspiciousUrls };
}

// ── Public API ──────────────────────────────────────────────────────────────

// Analysed result:
//   verdict       — "clean" | "suspicious" | "dangerous"
//   flags         — array of { id, category, severity, message, detail }
//   counts        — { urgency, financial, credential, secrecy, impersonation, links, pressure }
//   urlCount      — total links found (never their contents)
//   suspiciousUrlCount — suspicious links found (never their contents)
//   wordCount     — word count of the message
export function analyzeMessage(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;

  const lowerText = trimmed.toLowerCase();
  const { flags, counts, urls, suspiciousUrls } = detectFlags(trimmed, lowerText);

  // Sort by category order (dangerous/high-signal first), stable within a category.
  const orderIndex = Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, i]));
  flags.sort((a, b) => orderIndex[a.category] - orderIndex[b.category]);

  const verdict = computeVerdict(flags, { safeToken: "clean" });

  return {
    verdict,
    flags,
    counts,
    urlCount: urls.length,
    suspiciousUrlCount: suspiciousUrls.length,
    wordCount: trimmed.split(/\s+/).filter(Boolean).length,
  };
}
