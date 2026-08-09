import {
  createMD5,
  createSHA1,
  createSHA256,
  createSHA384,
  createSHA512,
} from "hash-wasm";

// Canonical algorithm list for the hashing modules (file-integrity +
// text-hash). MD5 and SHA-1 are legacy/deprecated cryptographically but
// kept because checksums in the wild still publish them.
export const SUPPORTED_ALGORITHMS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];

// One factory per algorithm. All come from hash-wasm so every algorithm
// shares the same incremental interface (init/update/digest) and the same
// WASM engine — there's no Web Crypto one-shot restriction and no
// synchronous JS hasher left on the main thread.
const FACTORIES = {
  MD5: createMD5,
  "SHA-1": createSHA1,
  "SHA-256": createSHA256,
  "SHA-384": createSHA384,
  "SHA-512": createSHA512,
};

// Progress is posted at most every PROGRESS_INTERVAL_MS — a hard cap on
// render rate regardless of how fast (or slow) the file hashes. There is
// no byte threshold: posting every N bytes would still allow hundreds of
// posts per second for a fast hasher.
const PROGRESS_INTERVAL_MS = 150;

export async function createHashers(algorithms) {
  const hashers = {};
  for (const algo of algorithms) {
    const factory = FACTORIES[algo];
    if (!factory) {
      throw new Error(`Unsupported algorithm: ${algo}`);
    }
    hashers[algo] = await factory();
    hashers[algo].init();
  }
  return hashers;
}

// Core streaming hash. `source` is any async-iterable of Uint8Array
// chunks; `totalBytes` (when known) is only used for progress reporting.
// Memory is bounded to the incoming chunk size regardless of how much data
// passes through, and the digest is identical to one-shot hashing of the
// same bytes.
export async function hashSource(source, algorithms, { totalBytes = 0, onProgress } = {}) {
  const hashers = await createHashers(algorithms);
  const results = {};
  let done = 0;
  let lastPost = { done: 0, at: 0 };

  for await (const chunk of source) {
    for (const algo of algorithms) {
      hashers[algo].update(chunk);
    }
    done += chunk.byteLength;
    if (onProgress) {
      const now = Date.now();
      if (now - lastPost.at >= PROGRESS_INTERVAL_MS) {
        lastPost = { done, at: now };
        onProgress({ done, total: totalBytes });
      }
    }
  }

  // One final progress post at 100%: the loop's throttle posts at most every
  // PROGRESS_INTERVAL_MS, so without this the last chunk can leave the bar
  // short of 100% (the "done" message then unmounts it).
  if (onProgress && totalBytes > 0 && lastPost.done !== totalBytes) {
    onProgress({ done: totalBytes, total: totalBytes });
  }

  for (const algo of algorithms) {
    results[algo] = hashers[algo].digest();
  }
  return results;
}

// Convenience wrapper over hashSource for Blob/File inputs: reads the
// blob's stream in browser-sized chunks (typically 64KB), so hashing a
// large file never materializes the whole thing in memory.
export function hashStream(blob, algorithms, options = {}) {
  const reader = blob.stream().getReader();
  const source = {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      return reader.read();
    },
  };
  return hashSource(source, algorithms, { ...options, totalBytes: blob.size });
}
