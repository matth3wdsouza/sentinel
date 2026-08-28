"use client";

import { Copy, Check } from "lucide-react";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";

/**
 * CodeBlock — a terminal-style code display with a copy button.
 *
 * Two appearance variants:
 *
 *   "dark" (default) — always-dark terminal look regardless of page theme.
 *     Right for shell commands, file paths, and anything that reads as
 *     "run this in a terminal". Uses literal Tailwind gray/zinc values
 *     rather than theme tokens so the dark appearance holds in light mode.
 *
 *   "themed" — follows the page theme using design-system tokens.
 *     Right for decoded output, data values, and code that is content
 *     rather than a command — things that should feel like part of the page
 *     rather than a separate terminal window.
 *
 * Props:
 *   code     {string}   The content to display and copy.
 *   label    {string?}  Accessible label for the copy button (default: "command").
 *   variant  {string?}  "dark" (default) | "themed"
 *   pre      {boolean?} Preserve whitespace and indentation (for multiline JSON etc).
 */
export default function CodeBlock({ code, label = "command", variant = "dark", pre = false }) {
  const [copied, copy] = useCopyToClipboard();

  function handleCopy() {
    copy(code);
  }

  const isDark = variant === "dark";

  return (
    <div
      className={`flex ${pre ? "items-start" : "items-center"} justify-between gap-3 px-3 py-2.5 rounded-lg font-mono text-xs ${
        isDark
          ? "bg-zinc-900 text-zinc-100"
          : "bg-slate-light text-ink border border-slate/15"
      }`}
    >
      {pre
        ? <pre className="overflow-x-auto whitespace-pre flex-1">{code}</pre>
        : <span className="break-all">{code}</span>
      }
      <button
        onClick={handleCopy}
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        title={label}
        className={`shrink-0 flex items-center transition ${
          isDark
            ? "text-teal-400 hover:text-teal-300"
            : "text-slate hover:text-teal"
        }`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}
