"use client";

// A single checkbox or radio row with a label, used for algorithm/character-
// type selection throughout the app. Extracted after the same markup
// (label wrapper + accent-teal input + hover row) turned up seven times
// across three modules, including both checkbox and radio variants.
export default function OptionRow({
  type = "checkbox",
  name,
  checked,
  onChange,
  children,
  hint,
}) {
  return (
    <label className="flex items-center gap-2 text-sm py-0.5 px-1 -mx-1 rounded hover:bg-slate-light cursor-pointer">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="accent-teal size-4"
      />
      {children}
      {hint && <span className="font-mono text-xs text-slate">{hint}</span>}
    </label>
  );
}
