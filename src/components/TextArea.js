"use client";

// Standard multi-line input for the analysis-style fields, shared by the
// inspector modules. Mirrors PasswordField's field styling; `mono` switches
// the font for code-style input (URLs). Pages keep their own <label> above
// it, matching the PasswordField convention.
export default function TextArea({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
  rows = 5,
  mono = false,
  resizable = true,
  id,
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      rows={rows}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      className={`w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:border-teal transition${mono ? " font-mono" : ""}${resizable ? " resize-y" : " resize-none"}`}
    />
  );
}