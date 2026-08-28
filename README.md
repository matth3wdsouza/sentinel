# Sentinel

A privacy-first security toolkit that runs entirely in your browser. No accounts, no servers, no telemetry — everything stays on your device.

## Modules

### Passwords & Passphrases
- **Password Generator** — Random passwords with exact entropy calculations
- **Passphrase Generator** — Diceware-style passphrases from EFF/BIP39 wordlists
- **Guessability** — Pattern-based password strength analysis (powered by zxcvbn)
- **HIBP Breach Check** — k-anonymity check against the Have I Been Pwned API; your password never leaves your browser

### Inspect & Analyse
- **File Integrity Verification** — Generate and compare MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes to verify downloads
- **EXIF Metadata Inspection** — See GPS coordinates, device info, and timestamps embedded in your photos
- **QR Code** — Decode a QR code before you follow it, or generate your own
- **URL Inspector** — Decompose a URL and flag phishing indicators: homograph tricks, typosquatting, suspicious TLDs, and more

### Developer Tools
- **Text Hash Generator** — Hash any string instantly across SHA-256, SHA-384, SHA-512, SHA-1, and MD5
- **Base64 Encoder / Decoder** — Encode and decode Base64 and Base64url (JWT-safe)
- **JWT Inspector** — Decode a JSON Web Token, read timestamps in plain English, and spot dangerous algorithm settings
- **TOTP Generator** — Enter a TOTP secret or `otpauth://` URI for a live 6-digit code with countdown
- **File Signature Verifier** — Check a file's magic bytes against its declared extension to detect spoofed file types

### Miscellaneous
- **Text Encryptor** — AES-256-GCM encryption with PBKDF2 key derivation; nothing leaves your browser
- **Browser Fingerprint** — See what your browser silently reveals to every site you visit
- **Clipboard Inspector** — See what sites can read from (and write to) your clipboard

## Privacy

All computation runs locally. The only external network request Sentinel makes is the HIBP k-anonymity prefix lookup (`api.pwnedpasswords.com`), which sends only the first 5 characters of your password's SHA-1 hash — never the password itself.

Activity is stored in IndexedDB on your device only. You can delete individual entries or clear everything from the Activity page at any time.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires Node.js 20.9+.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Lucide React](https://lucide.dev) icons
- [otpauth](https://github.com/hectorm/otpauth) for TOTP
- [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) for password guessability
- [hash-wasm](https://github.com/Daninet/hash-wasm) for streaming hashing (MD5 + SHA-1/256/384/512)
- [qrcode](https://github.com/soldair/node-qrcode) for QR generation and [@zxing/browser](https://github.com/zxing-js/library) for QR decoding
- [exifr](https://github.com/MikeKovarik/exifr) for EXIF metadata
