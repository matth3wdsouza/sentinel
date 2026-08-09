"use client";

// Standard inline error paragraph used across module pages for validation and
// operation failures. Unifies the previously hand-repeated
// `<p className="text-mismatch text-sm">` (with various margins) into one
// component; pass `className` to override spacing per context.

export default function InlineError({ children, className = "" }) {
  return <p className={`text-mismatch text-sm ${className}`}>{children}</p>;
}
