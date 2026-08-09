const COMMAND_TEMPLATES = {
  linux: {
    "MD5": (files) => `md5sum ${files}`,
    "SHA-1": (files) => `sha1sum ${files}`,
    "SHA-256": (files) => `sha256sum ${files}`,
    "SHA-384": (files) => `sha384sum ${files}`,
    "SHA-512": (files) => `sha512sum ${files}`,
  },
  macos: {
    "MD5": (files) => `md5 ${files}`,
    "SHA-1": (files) => `shasum -a 1 ${files}`,
    "SHA-256": (files) => `shasum -a 256 ${files}`,
    "SHA-384": (files) => `shasum -a 384 ${files}`,
    "SHA-512": (files) => `shasum -a 512 ${files}`,
  },
  windows: {
    "MD5": (files) => `Get-FileHash ${files} -Algorithm MD5`,
    "SHA-1": (files) => `Get-FileHash ${files} -Algorithm SHA1`,
    "SHA-256": (files) => `Get-FileHash ${files} -Algorithm SHA256`,
    "SHA-384": (files) => `Get-FileHash ${files} -Algorithm SHA384`,
    "SHA-512": (files) => `Get-FileHash ${files} -Algorithm SHA512`,
  },
};

export function detectLikelyOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

function quoteForShell(os, name) {
  // Single-quote wraps everything so no metacharacters are interpreted.
  // The only character that breaks a single-quoted string is the quote
  // itself, which is escaped per-shell:
  //   POSIX (bash/zsh):  ' → '\''   (close, escape, reopen)
  //   PowerShell:        ' → ''     (doubling is PowerShell's escape)
  if (os === "windows") return `'${name.replace(/'/g, "''")}'`;
  return `'${name.replace(/'/g, "'\\''")}'`;
}

export function buildCommand(os, algorithm, filenames) {
  // filenames: array of one or two filenames
  const quoted = filenames.map((name) => quoteForShell(os, name)).join(" ");
  const template = COMMAND_TEMPLATES[os]?.[algorithm];
  if (!template) return null;
  return template(quoted);
}
