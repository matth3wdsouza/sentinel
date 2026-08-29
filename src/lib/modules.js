import {
  FileCheck2,
  ScanEye,
  KeyRound,
  Gauge,
  ShieldAlert,
  ShieldX,
  Dice5,
  LockKeyhole,
  Fingerprint,
  ClipboardCheck,
  QrCode,
  Hash,
  Binary,
  KeySquare,
  Timer,
  Link,
  FileSearch2,
  Strikethrough,
  MessageSquareWarning,
  Square,
} from "lucide-react";

// Canonical module registry — single source of truth for every page that
// needs to know what modules exist: the home screen grid, the module
// management settings page, and any future surface that references modules
// by id.
//
// Valid status values:
//   "available"   — live and accessible
//   "coming-soon" — visible in the UI but not yet functional
//   "retired"     — no longer active; keep the entry so the activity log can
//                   still resolve the module's title and icon for historical
//                   entries. Retired modules are not rendered in the UI.
//
// Accent assignments — one color per category, see moduleAccents.js for palette rationale.
// emerald → Passwords & Passphrases, amber → Inspect & Analyse,
// blue → Developer Tools, violet → Miscellaneous.
export const CATEGORIES = [
  {
    id: "passwords",
    label: "Passwords & Passphrases",
    modules: [
      {
        id: "password-generator",
        title: "Password Generator",
        description:
          "Generate strong, random passwords with exact entropy calculations.",
        path: "/modules/password-generator",
        status: "available",
        icon: KeyRound,
        accent: "emerald",      // Passwords & Passphrases
      },
      {
        id: "passphrase-generator",
        title: "Passphrase Generator",
        description:
          "Generate diceware-style passphrases from a wordlist, with full entropy transparency.",
        path: "/modules/passphrase-generator",
        status: "available",
        icon: Dice5,
        accent: "emerald",      // Passwords & Passphrases
      },
      {
        id: "guessability",
        title: "Guessability",
        description:
          "Estimate how easily a password could be guessed, with pattern-based feedback.",
        path: "/modules/guessability",
        status: "available",
        icon: Gauge,
        accent: "emerald",      // Passwords & Passphrases
      },
      {
        id: "hibp",
        title: "HIBP Breach Check",
        description:
          "Check whether a password has appeared in a known data breach.",
        path: "/modules/hibp",
        status: "available",
        icon: ShieldAlert,
        accent: "emerald",      // Passwords & Passphrases
      },
      {
        id: "common-password",
        title: "Common Password Checker",
        description:
          "Check whether a password is among the 100,000 most common breached passwords.",
        path: "/modules/common-password",
        status: "available",
        icon: ShieldX,
        accent: "emerald",      // Passwords & Passphrases
      },
      {
        id: "pin-analyser",
        title: "PIN & Pattern Analyser",
        description:
          "Analyse a numeric PIN or passcode for the common guessable patterns — sequences, repeats, dates, keypad walks, and the most leaked codes.",
        path: "/modules/pin-analyser",
        status: "available",
        icon: Square,
        accent: "emerald",      // Passwords & Passphrases
      },
    ],
  },
  {
    id: "inspect",
    label: "Inspect & Analyse",
    modules: [
      {
        id: "file-integrity",
        title: "File Integrity Verification",
        description:
          "Generate and compare file hashes to verify downloads and detect tampering.",
        path: "/modules/file-integrity",
        status: "available",
        icon: FileCheck2,
        accent: "amber",        // Inspect & Analyse
      },
      {
        id: "exif",
        title: "EXIF Metadata Inspection",
        description:
          "Inspect hidden metadata — location, device info, timestamps — embedded in your photos.",
        path: "/modules/exif",
        status: "available",
        icon: ScanEye,
        accent: "amber",        // Inspect & Analyse
      },
      {
        id: "qr",
        title: "QR Code",
        description:
          "Decode a QR code and see exactly where it leads before you open it — or generate your own.",
        path: "/modules/qr",
        status: "available",
        icon: QrCode,
        accent: "amber",        // Inspect & Analyse
      },
      {
        id: "url-inspector",
        title: "URL Inspector",
        description:
          "Decompose a URL and flag phishing indicators — homograph tricks, suspicious TLDs, and encoded characters.",
        path: "/modules/url-inspector",
        status: "available",
        icon: Link,
        accent: "amber",        // Inspect & Analyse
      },
      {
        id: "unicode-inspector",
        title: "Hidden Unicode Inspector",
        description:
          "Reveal invisible or deceptive characters — zero-width spaces, bidi overrides, and look-alike homoglyphs.",
        path: "/modules/unicode-inspector",
        status: "available",
        icon: Strikethrough,
        accent: "amber",        // Inspect & Analyse
      },
    ],
  },
  {
    id: "developer",
    label: "Developer Tools",
    modules: [
      {
        id: "text-hash",
        title: "Text Hash Generator",
        description:
          "Hash any string instantly across SHA-256, SHA-384, SHA-512, SHA-1, and MD5. Nothing leaves your browser.",
        path: "/modules/text-hash",
        status: "available",
        icon: Hash,
        accent: "blue",         // Developer Tools
      },
      {
        id: "base64",
        title: "Base64 Encoder / Decoder",
        description:
          "Encode text to Base64 or decode Base64 back to text. Supports the Base64url variant used in JWTs and URLs.",
        path: "/modules/base64",
        status: "available",
        icon: Binary,
        accent: "blue",         // Developer Tools
      },
      {
        id: "jwt-inspector",
        title: "JWT Inspector",
        description:
          "Decode a JSON Web Token’s header and payload, read timestamps in plain English, and spot dangerous algorithm settings.",
        path: "/modules/jwt-inspector",
        status: "available",
        icon: KeySquare,
        accent: "blue",         // Developer Tools
      },
      {
        id: "totp",
        title: "TOTP Generator",
        description:
          "Enter a TOTP secret or otpauth:// URI to see a live 6-digit code with a 30-second countdown. Nothing is stored.",
        path: "/modules/totp",
        status: "available",
        icon: Timer,
        accent: "blue",         // Developer Tools
      },
      {
        id: "file-signature",
        title: "File Signature Verifier",
        description:
          "Check the magic bytes of a file against its declared extension to detect spoofed file types.",
        path: "/modules/file-signature",
        status: "available",
        icon: FileSearch2,
        accent: "blue",         // Developer Tools
      },
    ],
  },
  {
    id: "misc",
    label: "Miscellaneous",
    modules: [
      {
        id: "encryptor",
        title: "Text Encryptor",
        description:
          "Encrypt and decrypt text with a passphrase using AES-256-GCM. Nothing leaves your browser.",
        path: "/modules/encryptor",
        status: "available",
        icon: LockKeyhole,
        accent: "violet",       // Miscellaneous
      },
      {
        id: "fingerprint",
        title: "Browser Fingerprint",
        description:
          "See what your browser silently reveals to every website you visit — GPU model, CPU cores, timezone, and more.",
        path: "/modules/fingerprint",
        status: "available",
        icon: Fingerprint,
        accent: "violet",       // Miscellaneous
      },
      {
        id: "clipboard",
        title: "Clipboard Inspector",
        description:
          "See what sites can read from your clipboard — and how they can silently overwrite it without you noticing.",
        path: "/modules/clipboard",
        status: "available",
        icon: ClipboardCheck,
        accent: "violet",       // Miscellaneous
      },
      {
        id: "scam-message-analyser",
        title: "Scam Message Analyser",
        description:
          "Paste a suspicious SMS or email and see which common scam indicators it hits — urgency, money pressure, OTP requests, impersonation, and suspicious links.",
        path: "/modules/scam-message-analyser",
        status: "available",
        icon: MessageSquareWarning,
        accent: "violet",       // Miscellaneous
      },
    ],
  },
];

// Flat list of all modules across all categories, each annotated with its
// parent category id. Useful for search, module management, and any
// context where the category grouping isn't needed.
export const ALL_MODULES = CATEGORIES.flatMap((cat) =>
  cat.modules.map((m) => ({ ...m, categoryId: cat.id }))
);
