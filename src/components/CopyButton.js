"use client";

import { Copy, Check } from "lucide-react";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";

// A small icon-only copy button — click to copy `value` to the clipboard,
// shows a Check for 1.5 s then reverts. Used wherever a specific value
// (a hash, coordinate, token) sits next to a copy affordance.
//
// For the full "Copy password / Copy passphrase" primary-action button,
// use <Button> instead — this is intentionally lightweight and icon-only
// so it can sit inline next to text without visual weight.
export default function CopyButton({ value, label, className = "-m-2 p-2", onCopy }) {
  const [copied, copy] = useCopyToClipboard();

  async function handleCopy() {
    if (await copy(value)) onCopy?.();
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={`shrink-0 ${className} inline-flex items-center justify-center rounded text-slate hover:text-teal transition`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
