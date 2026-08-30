// Shared URL/content-analysis signals used by the inspector and content
// classifier modules. Kept in one place so the heuristics can't drift apart
// (the URL Inspector and Scam Message Analyser both flag suspicious TLDs;
// the Clipboard inspector and QR decoder both look for tracking parameters).

export const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "buzz", "club", "work", "info", "site", "online", "website",
  "space", "fun", "icu", "monster", "cam", "sbs", "cfd", "surf", "rest",
  "bond", "cyou", "uno", "lol",
]);

export const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "mc_eid", "ref", "_hsenc", "igshid",
];