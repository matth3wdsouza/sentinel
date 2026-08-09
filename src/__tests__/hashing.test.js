// Tests for src/lib/hashingCore.js
//
// What we're checking:
//   - chunked/incremental hashing produces byte-identical digests to
//     one-shot hashing (this is the property the whole streaming rework
//     depends on — same output as sha256sum/md5sum)
//   - chunk boundary position doesn't change the result (1-byte chunks vs
//     a single whole-buffer chunk vs a Blob's native stream)
//   - known reference vectors for every supported algorithm
//   - empty input hashes correctly
//   - unsupported algorithms are rejected with a clear error
//
// Note: this covers the pure hashing core, not computeHashes() in
// hashing.js — that facade spawns a Web Worker, which happy-dom doesn't
// implement. The worker itself only marshals bytes in/out of this core.

import { describe, it, expect } from "vitest";
import {
  SUPPORTED_ALGORITHMS,
  hashSource,
  hashStream,
  createHashers,
} from "@/lib/hashingCore";

function encode(str) {
  return new TextEncoder().encode(str);
}

// Known-good reference digests (RFC 1321, FIPS 180-2/4 test vectors).
const VECTORS = {
  "MD5": "900150983cd24fb0d6963f7d28e17f72",
  "SHA-1": "a9993e364706816aba3e25717850c26c9cd0d89d",
  "SHA-256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  "SHA-384": "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
  "SHA-512": "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
};

async function* chunkedSource(bytes, chunkSize) {
  for (let i = 0; i < bytes.length; i += chunkSize) {
    yield bytes.subarray(i, i + chunkSize);
  }
}

describe("known reference vectors", () => {
  for (const [algo, expected] of Object.entries(VECTORS)) {
    it(`${algo}("abc") matches the published test vector`, async () => {
      const results = await hashSource(chunkedSource(encode("abc"), 2), [algo]);
      expect(results[algo]).toBe(expected);
    });
  }
});

describe("streaming is byte-identical to one-shot", () => {
  // MD5 is excluded: Web Crypto's subtle.digest never supported MD5 (the
  // reason a JS/WASM MD5 implementation was needed in the first place).
  // MD5 is still covered by the vector + chunk-boundary tests above.
  const webCryptoAlgorithms = SUPPORTED_ALGORITHMS.filter((a) => a !== "MD5");

  it.each(webCryptoAlgorithms)(
    "%s: chunked result equals crypto.subtle.digest one-shot result",
    async (algo) => {
      const content = "The quick brown fox jumps over the lazy dog. ".repeat(50);
      const bytes = encode(content);
      const oneShot = await crypto.subtle.digest(
        { name: algo },
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      );
      const expected = Array.from(new Uint8Array(oneShot))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const results = await hashSource(chunkedSource(bytes, 1), [algo]);
      expect(results[algo]).toBe(expected);
    }
  );
});

describe("chunk boundaries don't matter", () => {
  it.each(SUPPORTED_ALGORITHMS)(
    "%s: 1-byte chunks == one whole-buffer chunk == Blob stream",
    async (algo) => {
      const content = "boundary".repeat(100);
      const bytes = encode(content);

      const tiny = await hashSource(chunkedSource(bytes, 1), [algo]);
      const whole = await hashSource([bytes], [algo]);
      const streamed = await hashStream(new Blob([bytes]), [algo]);

      expect(tiny[algo]).toBe(whole[algo]);
      expect(whole[algo]).toBe(streamed[algo]);
    }
  );
});

describe("empty input", () => {
  it.each(SUPPORTED_ALGORITHMS)("%s hashes empty input without error", async (algo) => {
    const results = await hashSource([], [algo]);
    expect(typeof results[algo]).toBe("string");
    expect(results[algo]).toMatch(/^[0-9a-f]+$/);
  });

  it("SHA-256 of empty input matches the known digest", async () => {
    const results = await hashSource([], ["SHA-256"]);
    expect(results["SHA-256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});

describe("algorithm validation", () => {
  it("rejects an unsupported algorithm", async () => {
    await expect(hashSource([], ["SHA-3"])).rejects.toThrow(
      "Unsupported algorithm: SHA-3"
    );
  });

  it("createHashers rejects an unsupported algorithm", async () => {
    await expect(createHashers(["CRC32"])).rejects.toThrow(
      "Unsupported algorithm: CRC32"
    );
  });
});

describe("hashStream accepts an onProgress callback", () => {
  it("returns results and tolerates a progress callback", async () => {
    const blob = new Blob([encode("progress test data")]);
    const results = await hashStream(blob, ["SHA-256"], {
      onProgress: () => {},
    });
    expect(results["SHA-256"]).toBeTypeOf("string");
  });
});
