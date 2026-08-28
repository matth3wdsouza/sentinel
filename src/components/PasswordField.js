"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Standard masked-input pattern: toggle lives inside the input's own
// boundary, not as a separate control elsewhere on the page — so it
// reads as part of the field it controls, not a second, disconnected
// control. Shared by HIBP and Guessability since both are the exact
// same shape (masked password input + show/hide), not two variants that
// happened to look similar.
export default function PasswordField({
  value,
  onChange,
  onEnter,
  placeholder = "Enter a password",
  ariaLabel,
  maxLength,
  autoComplete = "off",
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="w-full border border-slate/30 rounded-xl pl-4 pr-10 py-2.5 text-sm font-mono text-ink bg-surface focus:outline-none focus:border-teal transition"
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-teal transition"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
