import { analyzePassword } from "@/lib/guessability";

// Runs the actual analysis off the main thread. This exists because
// zxcvbn-ts's pattern matching has a measured, real worst case — repeated
// dictionary words with l33t substitutions took ~11 seconds at the
// 128-char cap in testing — and a synchronous main-thread call of that
// length would freeze the entire tab, not just feel janky. Moving it here
// means the page stays responsive (and can show an "Analyzing…" state)
// while this runs in the background.
self.onmessage = (event) => {
  const password = event.data;
  try {
    const result = analyzePassword(password);
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ error: err.message ?? "ANALYSIS_FAILED" });
  }
};
