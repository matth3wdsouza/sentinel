// companionLinks.js — the standalone cross-module "next step" link graph.
//
// Mirrors moduleAccents.js: a per-module data file kept separate from the
// canonical registry (modules.js) so the link graph is auditable in one
// place instead of scattered across ~20 module pages.
//
// Only *standalone* links live here — "you might also want this," shown
// regardless of outcome. Outcome-gated links ("your password was found →
// generate a new one") stay inline in the page next to the result state,
// where the condition naturally lives, and are passed straight to
// <CompanionLinks links={[...]} /> by the page.
//
// Keys are the source module's canonical path (see ALL_MODULES in
// modules.js). The `href` of every link must be another module's canonical
// path — companionLinks.test.js verifies this.

export const COMPANION_LINKS = {
  // Inspect & Analyse
  "/modules/url-inspector": [
    {
      href: "/modules/unicode-inspector",
      label: "Inspect the hostname for hidden characters",
    },
    {
      href: "/modules/scam-message-analyser",
      label: "Analyse a suspicious message instead",
    },
  ],

  // Passwords & Passphrases
  "/modules/password-generator": [
    {
      href: "/modules/clipboard",
      label: "See what your clipboard reveals",
    },
  ],
  "/modules/passphrase-generator": [
    {
      href: "/modules/clipboard",
      label: "See what your clipboard reveals",
    },
  ],

  // Miscellaneous
  "/modules/fingerprint": [
    {
      href: "/modules/clipboard",
      label: "See what your clipboard reveals",
    },
  ],
  "/modules/totp": [
    {
      href: "/modules/qr",
      label: "Have a QR code instead? Decode it first",
    },
  ],

  // Developer Tools
  "/modules/jwt-inspector": [
    {
      href: "/modules/base64",
      label: "Inspect the raw base64url encoding",
    },
  ],
  "/modules/base64": [
    {
      href: "/modules/jwt-inspector",
      label: "Pasted a JWT? Decode its parts instead",
    },
  ],
};

// Resolve the standalone companion links for a module path.
// Returns [] for sources without registry entries.
export function companionLinksFor(path) {
  return COMPANION_LINKS[path] ?? [];
}