// Canonical severity tokens and styling for the inspector modules (URL,
// Unicode, Scam, PIN, …). The severity string tokens ("danger"/"warning"/
// "info") each analysis returns are the same everywhere, so they live here
// once instead of being re-minted per page.
export const DANGER = "danger";
export const WARNING = "warning";
export const INFO = "info";

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

// Standard verdict for a set of severity-ranked findings: any danger-level
// flag → "dangerous", else any warning flag → "suspicious", else the module's
// own all-clear token. `safeToken` lets each module keep its existing
// vocabulary (URL/"safe", Scam/"clean") without changing behaviour.
export function computeVerdict(flags, { safeToken = "safe" } = {}) {
  const hasDanger = flags.some((f) => f.severity === DANGER);
  const hasWarning = flags.some((f) => f.severity === WARNING);

  if (hasDanger) return "dangerous";
  if (hasWarning) return "suspicious";
  return safeToken;
}