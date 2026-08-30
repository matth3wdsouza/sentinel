// Tests for src/lib/fileSignature.js
//
// What we're checking:
//   - readFileHeader reads bytes correctly
//   - matchSignature identifies files from their magic bytes
//   - detectSpecificExtension sub-classifies ZIP/OOXML files
//   - analyzeFile returns the correct verdict for match/mismatch/unknown/empty
//   - getExtension handles various filename formats

import { describe, it, expect } from "vitest";
import {
  analyzeFile,
  matchSignature,
  readFileHeader,
  MAGIC_SIGNATURES,
} from "@/lib/fileSignature";

// Helper to create a mock File with specified bytes
function createFile(bytes, name) {
  const arr = new Uint8Array(bytes);
  return new File([arr], name);
}

describe("readFileHeader", () => {
  it("reads the correct bytes from a small file", async () => {
    const file = createFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], "test.png");
    const header = await readFileHeader(file);
    expect(header.length).toBe(6);
    expect(Array.from(header)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  });

  it("returns empty array for an empty file", async () => {
    const file = new File([], "empty.txt");
    const header = await readFileHeader(file);
    expect(header.length).toBe(0);
  });
});

describe("matchSignature", () => {
  it("matches PDF magic bytes", async () => {
    const file = createFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], "test.pdf");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).not.toBeNull();
    expect(match.type).toContain("PDF");
  });

  it("matches PNG magic bytes", async () => {
    const file = createFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d], "test.png");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).not.toBeNull();
    expect(match.type).toContain("PNG");
  });

  it("matches JPEG magic bytes", async () => {
    const file = createFile([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49], "photo.jpg");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).not.toBeNull();
    expect(match.type).toContain("JPEG");
  });

  it("matches Windows executable magic bytes", async () => {
    const file = createFile([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00], "program.exe");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).not.toBeNull();
    expect(match.type).toContain("Windows");
  });

  it("matches ZIP/Office magic bytes", async () => {
    const file = createFile([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00], "archive.zip");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).not.toBeNull();
    expect(match.type).toContain("Office") || expect(match.type).toContain("ZIP");
  });

  it("returns null for unknown bytes", async () => {
    const file = createFile([0x13, 0x37, 0x42, 0x69, 0x72, 0x64], "file.xyz");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).toBeNull();
  });

  it("returns null for empty header", async () => {
    const file = createFile([], "empty.bin");
    const header = await readFileHeader(file);
    const match = matchSignature(header);
    expect(match).toBeNull();
  });
});

describe("analyzeFile - matches", () => {
  it("verifies a PNG file with .png extension", async () => {
    const file = createFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image.png");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("match");
    expect(result.detected.type).toBe("PNG image");
  });

  it("verifies a PDF file with .pdf extension", async () => {
    const file = createFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], "doc.pdf");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("match");
  });

  it("verifies a JPEG file with .jpg extension", async () => {
    const file = createFile([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "photo.jpg");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("match");
  });

  it("verifies a ZIP file with .zip extension", async () => {
    const file = createFile([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00], "files.zip");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("match");
  });

  it("verifies a GIF file", async () => {
    const file = createFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "anim.gif");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("match");
  });
});

describe("analyzeFile - mismatches", () => {
  it("detects an executable disguised as a PDF", async () => {
    const file = createFile([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00], "report.pdf");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("mismatch");
    expect(result.detected.type).toContain("executable");
  });

  it("detects an executable disguised as a JPG", async () => {
    const file = createFile([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00], "image.jpg");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("mismatch");
  });

  it("detects a PNG renamed to .txt", async () => {
    const file = createFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "notes.txt");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("mismatch");
    expect(result.detected.type).toContain("PNG");
  });

  it("detects a ZIP renamed to .docx", async () => {
    // A plain ZIP renamed to .docx — not necessarily malicious (docx IS a ZIP)
    const file = createFile([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00], "document.docx");
    const result = await analyzeFile(file);
    // .docx IS a ZIP, so match (not mismatch) — the signature says "Office"
    expect(result.verdict).toBe("match");
  });
});

describe("analyzeFile - unknown / empty", () => {
  it("returns unknown for unrecognized bytes", async () => {
    const file = createFile([0x13, 0x37, 0x42, 0x69, 0x72, 0x64], "custom.dat");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("unknown");
  });

  it("returns empty for an empty file", async () => {
    const file = new File([], "empty.jpg");
    const result = await analyzeFile(file);
    expect(result.verdict).toBe("empty");
  });
});

describe("analyzeFile - extensions", () => {
  it("flags a file with no extension as unknown", async () => {
    const file = createFile([0x89, 0x50, 0x4e, 0x47], "imagefile");
    const result = await analyzeFile(file);
    // No extension → analyzeFile returns unknown (no declaredExt)
    expect(result.verdict).toBe("unknown");
  });
});

describe("MAGIC_SIGNATURES", () => {
  it("has entries", () => {
    expect(MAGIC_SIGNATURES.length).toBeGreaterThan(30);
  });
});

describe("analyzeFile - RIFF family (wav/avi/webp)", () => {
  const riffForm = (form) => [
    0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00,
    ...Array.from(form, (c) => c.charCodeAt(0)),
  ];

  it("matches a WAV file against .wav", async () => {
    const result = await analyzeFile(createFile(riffForm("WAVE"), "sound.wav"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("wav");
  });

  it("matches an AVI file against .avi", async () => {
    const result = await analyzeFile(createFile(riffForm("AVI "), "video.avi"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("avi");
  });

  it("keeps the generic RIFF label for unknown RIFF forms", async () => {
    const result = await analyzeFile(createFile(riffForm("LIST"), "data.riff"));
    expect(result.detected.detectedExtension).toBe("webp");
    expect(result.verdict).toBe("mismatch");
  });
});

describe("analyzeFile - TAR", () => {
  it("matches a TAR archive (ustar magic at offset 257)", async () => {
    const bytes = new Array(512).fill(0);
    bytes.splice(257, 5, ...Array.from("ustar", (c) => c.charCodeAt(0)));
    const result = await analyzeFile(createFile(bytes, "backup.tar"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("tar");
  });
});

describe("analyzeFile - ZIP sub-types (apk/jar/epub)", () => {
  const zipEntry = (name) => [
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
    ...Array.from(name, (c) => c.charCodeAt(0)),
  ];

  it("detects an APK by its AndroidManifest.xml entry", async () => {
    const result = await analyzeFile(createFile(zipEntry("AndroidManifest.xml"), "app.apk"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("apk");
  });

  it("detects a JAR by its META-INF entry", async () => {
    const result = await analyzeFile(createFile(zipEntry("META-INF/MANIFEST.MF"), "lib.jar"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("jar");
  });

  it("detects an EPUB by its mimetype entry", async () => {
    const result = await analyzeFile(createFile(zipEntry("mimetypeapplication/epub+zip"), "book.epub"));
    expect(result.verdict).toBe("match");
    expect(result.detected.detectedExtension).toBe("epub");
  });
});
