// Pure-logic file signature analysis for the File Signature Verifier module.
// Reads the first few bytes of a file and compares them to known magic byte
// signatures to identify the actual file type, then compares against the file's
// declared extension.

// ── Magic byte signatures ────────────────────────────────────────────────────
// Each entry: { bytes: number[], offset, type, ext, description }

const MAGIC_SIGNATURES = [
  // ── Documents ─────────────────────────────────────────────────────────
  { bytes: [0x25, 0x50, 0x44, 0x46], ext: "pdf", type: "PDF document", description: "Portable Document Format" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], ext: "docx", type: "ZIP archive (Office/APK/JAR/EPUB)", description: "ZIP container — check contents for exact type" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], ext: "zip", type: "Empty ZIP archive", description: "ZIP archive (empty)" },
  { bytes: [0x50, 0x4b, 0x07, 0x08], ext: "zip", type: "ZIP archive (spanned)", description: "ZIP archive (spanned)" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], ext: "doc", type: "Microsoft Compound Document (doc/xls/ppt)", description: "OLE2 compound document" },

  // ── Images ─────────────────────────────────────────────────────────────
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "png", type: "PNG image", description: "Portable Network Graphics" },
  { bytes: [0xff, 0xd8, 0xff], ext: "jpg", type: "JPEG image", description: "Joint Photographic Experts Group" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], ext: "gif", type: "GIF image", description: "Graphics Interchange Format (87a)" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], ext: "gif", type: "GIF image", description: "Graphics Interchange Format (89a)" },
  { bytes: [0x42, 0x4d], ext: "bmp", type: "BMP image", description: "Windows Bitmap" },
  { bytes: [0x49, 0x49, 0x2a, 0x00], ext: "tiff", type: "TIFF image (little-endian)", description: "Tagged Image File Format" },
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], ext: "tiff", type: "TIFF image (big-endian)", description: "Tagged Image File Format" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "webp", type: "RIFF container (webp/avi/wav)", description: "RIFF — check extension for exact type" },
  { bytes: [0x00, 0x00, 0x01, 0x00], ext: "ico", type: "ICO icon", description: "Windows icon" },

  // ── Executables ──────────────────────────────────────────────────────
  { bytes: [0x4d, 0x5a], ext: "exe", type: "Windows executable (MZ)", description: "DOS/Windows executable or DLL" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], ext: "elf", type: "ELF executable", description: "Executable and Linkable Format" },
  { bytes: [0x63, 0x61, 0x66, 0x65, 0x62, 0x61, 0x62, 0x65], ext: "mach", type: "Mach-O binary", description: "macOS executable" },

  // ── Archives ──────────────────────────────────────────────────────────
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], ext: "rar", type: "RAR archive", description: "Roshal Archive" },
  { bytes: [0x1f, 0x8b], ext: "gz", type: "GZip archive", description: "GNU zip compressed data" },
  { bytes: [0x42, 0x5a, 0x68], ext: "bz2", type: "BZip2 archive", description: "Bzip2 compressed data" },
  { bytes: [0x28, 0xb5, 0x2f, 0xfd], ext: "7z", type: "7-Zip archive", description: "7-Zip compressed archive" },
  { bytes: [0x75, 0x73, 0x74, 0x61, 0x72], ext: "tar", offset: 257, type: "TAR archive", description: "Tape Archive" },
  { bytes: [0x5a, 0x4d], ext: "exe", type: "Windows executable", description: "DOS executable" },

  // ── Media ─────────────────────────────────────────────────────────────
  { bytes: [0x4f, 0x67, 0x67, 0x53], ext: "ogg", type: "Ogg container", description: "Ogg Vorbis/Opus audio or video" },
  { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], ext: "mp4", type: "MP4 video", offset: 4, description: "ISO Base Media (MP4/M4A)" },
  { bytes: [0x49, 0x44, 0x33], ext: "mp3", type: "MP3 audio (ID3 tag)", description: "MPEG audio with ID3 tag" },
  { bytes: [0xff, 0xfb], ext: "mp3", type: "MP3 audio", description: "MPEG-1/2 Layer 3 audio" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "wav", type: "WAV audio", description: "Waveform audio" },
  { bytes: [0x41, 0x56, 0x49, 0x20], ext: "avi", type: "AVI video", offset: 8, description: "Audio Video Interleave" },
  { bytes: [0x4d, 0x54, 0x68, 0x64], ext: "mid", type: "MIDI file", description: "Musical Instrument Digital Interface" },
  { bytes: [0x46, 0x4c, 0x56], ext: "flv", type: "Flash video", description: "Flash Video" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], ext: "mkv", type: "Matroska (mkv/webm)", description: "Matroska container" },
  { bytes: [0x4f, 0x67, 0x67, 0x53], ext: "ogv", type: "Ogg video", description: "Ogg video container" },

  // ── Fonts ────────────────────────────────────────────────────────────
  { bytes: [0x4f, 0x54, 0x54, 0x4f], ext: "otf", type: "OpenType font", description: "OpenType font" },
  { bytes: [0x00, 0x01, 0x00, 0x00], ext: "ttf", type: "TrueType font", description: "TrueType font" },
  { bytes: [0x77, 0x4f, 0x46, 0x46], ext: "woff", type: "WOFF font", description: "Web Open Font Format" },
  { bytes: [0x77, 0x4f, 0x46, 0x32], ext: "woff2", type: "WOFF2 font", description: "Web Open Font Format 2" },

  // ── Code / text ─────────────────────────────────────────────────────
  { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], ext: "xml", type: "XML document", description: "Extensible Markup Language" },
  { bytes: [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45], ext: "html", type: "HTML document", description: "HTML with DOCTYPE" },
  { bytes: [0x3c, 0x68, 0x74, 0x6d, 0x6c], ext: "html", type: "HTML document", description: "HTML document" },
  { bytes: [0x3c, 0x73, 0x76, 0x67], ext: "svg", type: "SVG image", description: "Scalable Vector Graphics" },
  { bytes: [0x7b, 0x22], ext: "json", type: "JSON object", description: "JavaScript Object Notation" },
  { bytes: [0x5b], ext: "json", type: "JSON array", description: "JavaScript Object Notation" },

  // ── Mobile / misc ────────────────────────────────────────────────
  { bytes: [0x4d, 0x5a], ext: "dll", type: "Windows DLL (MZ)", description: "Dynamic Link Library" },
  { bytes: [0x43, 0x52, 0x45, 0x47, 0x00], ext: "reg", type: "Windows Registry file", description: "Registry export" },
  { bytes: [0x4d, 0x53, 0x43, 0x46], ext: "cab", type: "Microsoft Cabinet", description: "Cabinet archive" },
  { bytes: [0x53, 0x51, 0x4c, 0x69], ext: "sqlite", type: "SQLite database", description: "SQLite database file" },
  { bytes: [0x53, 0x48, 0x45, 0x4c, 0x4c], ext: "nu", type: "Shell script", description: "Shell archive" },
  { bytes: [0x21, 0x42, 0x53, 0x4e], ext: "bsn", type: "BSN archive", description: "BSN archive" },

  // ── Certificates / crypto ──────────────────────────────────────────
  { bytes: [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x42, 0x45, 0x47, 0x49, 0x4e], ext: "pem", type: "PEM certificate/key", description: "PEM-encoded certificate or key" },
  { bytes: [0x30, 0x82], ext: "der", type: "DER certificate", description: "DER-encoded certificate" },
];

// ── Analysis ────────────────────────────────────────────────────────────────

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function getExtension(filename) {
  const clean = filename.replace(/\s+/g, "").toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

// Read just the first 512 bytes of a file (and a few bytes at known offsets
// for signatures that don't start at byte 0).
export async function readFileHeader(file) {
  const CHUNK_SIZE = 4096;
  const buffer = new ArrayBuffer(CHUNK_SIZE);
  const view = new Uint8Array(buffer);

  let bytesRead = 0;
  const stream = file.stream();
  const reader = stream.getReader();

  try {
    while (bytesRead < CHUNK_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      const toCopy = Math.min(value.length, CHUNK_SIZE - bytesRead);
      view.set(value.subarray(0, toCopy), bytesRead);
      bytesRead += toCopy;
      if (bytesRead >= CHUNK_SIZE) break;
    }
  } finally {
    reader.releaseLock();
  }

  return view.subarray(0, bytesRead);
}

export function matchSignature(header) {
  if (!header || header.length === 0) return null;

  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    // Skip if header doesn't reach the signature's end
    if (offset + sig.bytes.length > header.length) continue;

    const matches = sig.bytes.every((b, i) => header[offset + i] === b);
    if (matches) {
      return {
        type: sig.type,
        ext: sig.ext,
        description: sig.description,
        // Sub-classify some signatures by extension
        detectedExtension: detectSpecificExtension(header, sig.ext),
      };
    }
  }
  return null;
}

function detectSpecificExtension(header, baseExt) {
  if (baseExt === "docx") {
    // ZIP containers can't be told apart from their magic bytes alone, so
    // scan the header text for the distinguishing entry paths. Non-Office
    // formats are checked first because their markers are more specific;
    // docx remains the fallback so plain/renamed Zips don't regress.
    const text = arrayBufferToText(header);
    if (text.includes("application/epub+zip") || text.includes("mimetype")) return "epub";
    if (text.includes("AndroidManifest.xml") || text.includes("classes.dex")) return "apk";
    if (text.includes("META-INF/")) return "jar";
    if (text.includes("word/")) return "docx";
    if (text.includes("xl/")) return "xlsx";
    if (text.includes("ppt/")) return "pptx";
    return "docx";
  }
  if (baseExt === "webp") {
    // RIFF containers carry their real format in bytes 8-11 (WAVE, AVI).
    const form =
      header.length >= 12
        ? String.fromCharCode(header[8], header[9], header[10], header[11])
        : "";
    if (form === "WAVE") return "wav";
    if (form === "AVI " || form === "AVIX") return "avi";
    return "webp"; // WEBP or an unrecognised form — keeps the generic RIFF label
  }
  return baseExt;
}

function arrayBufferToText(bytes) {
  // Convert a subset of the header to text for signature sub-classification.
  // Limited to the first few KB so we don't try decoding a huge buffer.
  const chunk = bytes.subarray(0, Math.min(bytes.length, 2048));
  const bin = Array.from(chunk, (b) => String.fromCharCode(b)).join("");
  try {
    return decodeURIComponent(escape(bin));
  } catch {
    return bin;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function analyzeFile(file) {
  const ext = getExtension(file.name);
  if (!ext) {
    return {
      declaredExtension: null,
      detected: null,
      verdict: "unknown",
      message: "No file extension detected",
    };
  }

  const header = await readFileHeader(file);
  if (header.length === 0) {
    return {
      declaredExtension: ext,
      detected: null,
      verdict: "empty",
      message: "Empty file",
    };
  }

  const match = matchSignature(header);
  if (!match) {
    return {
      declaredExtension: ext,
      detected: null,
      verdict: "unknown",
      message: "Unknown file type (no matching magic bytes)",
    };
  }

  const detected = {
    ...match,
    hex: bytesToHex(header.subarray(0, 16)),
  };

  const extMatches = ext === match.detectedExtension;
  const extIsGenericZip = ["zip", "docx", "xlsx", "pptx", "apk", "jar", "epub"].includes(ext);

  let verdict;
  let message;

  if (ext === match.detectedExtension) {
    verdict = "match";
    message = `The file's magic bytes match the declared .${ext} extension.`;
  } else if (extIsGenericZip && match.detectedExtension === "docx") {
    verdict = "match";
    message = `The file is a ZIP-based Office document. The declared .${ext} extension is compatible.`;
  } else if (match.detectedExtension === "docx" && ["doc", "xls", "ppt"].includes(ext)) {
    verdict = "mismatch";
    message = `The file is a ZIP-based Office document, not a legacy .${ext} file. Legacy Office files use the OLE2 format, not ZIP.`;
  } else if (match.detectedExtension === "doc" && ["docx", "xlsx", "pptx"].includes(ext)) {
    verdict = "mismatch";
    message = `The file is a legacy OLE2 compound document, not a .${ext} file.`;
  } else if (match.detectedExtension === "exe") {
    verdict = "mismatch";
    message = `The file is a Windows executable. This is NOT a ${ext.toUpperCase()} file — the extension appears to have been renamed.`;
  } else if (match.detectedExtension !== ext) {
    verdict = "mismatch";
    message = `The file's magic bytes indicate a ${match.type}, but its declared extension is .${ext}.`;
  } else {
    verdict = "match";
    message = `The file's magic bytes match the declared .${ext} extension.`;
  }

  return {
    declaredExtension: ext,
    detected,
    verdict,
    message,
  };
}

export { MAGIC_SIGNATURES };
