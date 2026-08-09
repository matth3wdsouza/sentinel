import { SUPPORTED_ALGORITHMS } from "@/lib/hashingCore";

export { SUPPORTED_ALGORITHMS };

// Above this size, hashing is safe (it streams) but can take several
// seconds, so the file-integrity tabs also show the equivalent terminal
// command as an optional, faster-for-big-files alternative. Purely
// advisory — hashing in-browser always works. This is a UI policy
// constant, not a safety cap: memory is bounded by the stream chunk size
// regardless of file size.
export const BIG_FILE_SUGGESTION_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// Client-side facade for hashing a Blob/File. The actual work happens in
// hashing.worker.js: it reads the file in stream chunks and feeds them to
// incremental hash-wasm hashers, so neither the main thread blocks nor the
// whole file is ever materialized in memory. `onProgress` receives
// { done, total } (bytes) at most a few times per second.
//
// Each call spawns its own worker and terminates it when the hash
// finishes, errors, or the caller drops the promise — there's no shared
// worker to leak or race against.
export function computeHashes(file, algorithms, { onProgress } = {}) {
  const invalid = algorithms.filter((algo) => !SUPPORTED_ALGORITHMS.includes(algo));
  if (invalid.length > 0) {
    return Promise.reject(new Error(`Unsupported algorithm: ${invalid[0]}`));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./hashing.worker.js", import.meta.url));

    function cleanup() {
      worker.terminate();
    }

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.({ done: message.done, total: message.total });
      } else if (message.type === "done") {
        cleanup();
        resolve(message.results);
      } else if (message.type === "error") {
        cleanup();
        reject(new Error(message.message));
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error("Hashing failed — the worker crashed. Try again."));
    };

    worker.postMessage({ file, algorithms });
  });
}
