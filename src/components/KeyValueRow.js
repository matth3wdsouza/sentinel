"use client";

import CopyButton from "@/components/CopyButton";

// A labelled value row with an optional copy affordance — the standard
// "label → value" unit shared by the inspector/breakdown modules (URL parts,
// JWT fields, hash results, EXIF/fingerprint records, QR previews).
//
// `variant` flips between label-above-value ("stacked") and label-left
// ("row"). `tone` colours the value ("mismatch"/"warning" → the flagged
// highlight colour, used by QR tracking params and JWT's weak fields;
// "match" → green, used by QR's sanitised URL). `emptyText` renders in italic
// when the value is null/blank. The caller owns the surrounding container's
// spacing/dividers via `className`.
export default function KeyValueRow({
  label,
  value,
  mono = false,
  copyable = false,
  copyLabel = label,
  emptyText = "Not available",
  size = "sm",
  tone,
  variant = "stacked",
  className = "",
}) {
  const isPresent =
    value !== null && value !== undefined && String(value).length > 0;

  const sizeClass = variant === "row" || size === "xs" ? "text-xs" : "text-sm";
  const valueClasses = [
    "break-all",
    isPresent
      ? tone === "warning"
        ? "text-mismatch font-medium"
        : tone === "mismatch"
          ? "text-mismatch"
          : tone === "match"
            ? "text-match"
            : "text-ink"
      : "text-slate italic",
    mono ? "font-mono" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "row") {
    return (
      <div className={`flex items-start justify-between gap-4 ${className}`}>
        <span className="text-xs text-slate shrink-0 w-40">{label}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`${sizeClass} text-right ${valueClasses}`}>
            {isPresent ? String(value) : emptyText}
          </span>
          {copyable && (
            <CopyButton value={String(value)} label={copyLabel} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
        <p className={`${sizeClass} ${valueClasses}`}>
          {isPresent ? String(value) : emptyText}
        </p>
      </div>
      {copyable && (
        <CopyButton
          value={String(value)}
          label={copyLabel}
          className="mt-2 p-2"
        />
      )}
    </div>
  );
}