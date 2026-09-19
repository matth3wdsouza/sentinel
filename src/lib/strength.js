/**
 * Plain-language strength label for a given entropy value, with a verdict
 * key that maps directly onto ResultCard's VERDICT_CONFIG so the label and
 * the result card's color coding always agree.
 */
export function strengthLabel(entropyBits) {
  if (entropyBits < 40) {
    return { label: "Weak", verdict: "mismatch" };
  }
  if (entropyBits < 60) {
    return { label: "Reasonable", verdict: "fallback" };
  }
  if (entropyBits < 80) {
    return { label: "Strong", verdict: "match" };
  }
  return { label: "Very strong", verdict: "success" };
}