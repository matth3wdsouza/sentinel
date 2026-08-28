"use client";

import { RotateCcw } from "lucide-react";

// Two variants that cover every button pattern across the module pages:
//
//   primary — the teal action button ("Check password", "Encrypt", "Inspect image"…)
//             Accepts disabled, loading/loadingLabel, and an optional fullWidth flag.
//             When loading is true, pass loadingLabel too (e.g. "Checking…") so the
//             button reads as in-progress rather than showing its action text.
//             Shadow is intentionally omitted — card-elevation shadows on buttons
//             look like the button is floating off the page.
//
//   ghost   — the secondary text button used for Reset, "Try again", "Read again"…
//             Optionally prepends a RotateCcw icon when `resetIcon` is true.

export function Button({
  variant = "primary",
  children,
  resetIcon = false,
  loadingLabel,
  loading = false,
  fullWidth = false,
  className = "",
  ...props
}) {
  if (variant === "primary") {
    return (
      <button
        {...props}
        className={`inline-flex items-center justify-center gap-2 bg-teal text-on-teal px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal/90 active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none ${fullWidth ? "w-full" : ""} ${className}`}
      >
        {loading && loadingLabel ? loadingLabel : children}
      </button>
    );
  }

  // ghost
  return (
    <button
      {...props}
      className={`flex items-center gap-1.5 text-sm text-slate hover:text-teal transition ${className}`}
    >
      {resetIcon && <RotateCcw size={14} />}
      {children}
    </button>
  );
}
