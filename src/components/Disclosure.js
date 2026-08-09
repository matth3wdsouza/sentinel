"use client";

import { useId } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

// Shared expand/collapse toggle for the app's accordion-style sections:
// guessability's "More detail", the password generator's "Advanced options",
// EXIF removal guides, and activity rows. Centralises the aria-expanded /
// aria-controls / useId wiring that each site previously hand-rolled (and
// half of them were missing aria-controls). `open`/`onToggle` are controlled
// by the parent so reset behaviour and state stay with the caller.
//
// Two chevron conventions exist in the app, selected via `chevron`:
//   - "chevron-right" (default): right-chevron rotating to down — the teal
//     text-link toggles (guessability, advanced options).
//   - "chevron-up": up-chevron rotating to down — the bordered accordion
//     rows (EXIF removal guides).
// Class props map 1:1 to the per-site styling each caller already had, so the
// markup is unchanged — only the a11y wiring is centralised.

export default function Disclosure({
  label,
  ariaLabel,
  open,
  onToggle,
  className = "",
  buttonClassName = "",
  contentClassName = "",
  labelClassName = "",
  chevronClassName = "",
  chevron = "chevron-right",
  children,
}) {
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={ariaLabel}
        className={buttonClassName}
      >
        {label && <span className={labelClassName}>{label}</span>}
        {chevron === "chevron-right" &&
          (open ? (
            <ChevronDown size={14} className={chevronClassName} />
          ) : (
            <ChevronRight size={14} className={chevronClassName} />
          ))}
        {chevron === "chevron-up" &&
          (open ? (
            <ChevronUp size={14} className={chevronClassName} />
          ) : (
            <ChevronDown size={14} className={chevronClassName} />
          ))}
      </button>
      <div id={contentId} className={contentClassName} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
