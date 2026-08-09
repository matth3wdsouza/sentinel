import { hashStream } from "@/lib/hashingCore";

// Streams a file through incremental WASM hashers off the main thread.
// This exists for the same reason as the guessability worker: hashing a
// multi-GB file takes seconds, and blocking the main thread for that long
// would freeze the whole tab. The worker reads the file in chunks (the
// browser's stream reader yields ~64KB at a time), feeds each chunk to
// every selected hasher, throttles progress messages, and posts the final
// hex digests. Memory stays bounded to the chunk size no matter how large
// the file is — the whole file is never materialized in one buffer.
self.onmessage = async (event) => {
  const { file, algorithms } = event.data;
  try {
    const results = await hashStream(file, algorithms, {
      onProgress: (progress) => self.postMessage({ type: "progress", ...progress }),
    });
    self.postMessage({ type: "done", results });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
