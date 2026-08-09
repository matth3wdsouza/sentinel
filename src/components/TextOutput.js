"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";

// Shared "readable prose output" box used by the encryptor, base64 and
// clipboard modules: uppercase label, lightweight copy button, and a bordered
// surface for the value. Intentionally not CodeBlock — the output is user
// data (decrypted/decoded text, clipboard contents), not a terminal command.
// When `maxChars` is set the value is truncated with a show-more toggle;
// copy always sends the full text, matching all three original behaviours.

export default function TextOutput({
  label,
  text,
  mono = false,
  maxChars,
  className = "mt-1 mb-3",
  containerClassName = "",
}) {
  const [copied, copy] = useCopyToClipboard();
  const [expanded, setExpanded] = useState(false);
  const isTruncated = maxChars && text.length > maxChars;
  const displayed = isTruncated && !expanded ? text.slice(0, maxChars) : text;

  function handleCopy() {
    copy(text);
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-slate hover:text-teal transition"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={`border border-slate/20 rounded-xl px-4 py-3 text-sm text-ink bg-surface whitespace-pre-wrap break-words ${mono ? "font-mono" : ""} ${containerClassName}`}
      >
        {displayed}
        {isTruncated && !expanded && <span className="text-slate">…</span>}
      </div>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs text-slate hover:text-teal transition"
        >
          {expanded ? "Show less" : `Show full content (${text.length} characters)`}
        </button>
      )}
    </div>
  );
}
