// Canonical severity styling for the inspector modules (URL, Unicode, Scam,
// PIN). The severity string tokens ("danger"/"warning"/"info") each analysis
// returns are the same everywhere, so the dot/badge chips and their labels
// live here once instead of being re-minted per page.
export const SEVERITY_STYLE = {
  danger: {
    dot: "bg-mismatch",
    badge: "bg-mismatch-light text-mismatch-chip",
    label: "High signal",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Warning",
  },
  info: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate",
    label: "Info",
  },
};