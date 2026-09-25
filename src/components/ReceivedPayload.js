"use client";

// Provenance tag for pages that received a payload through the module
// bridge (src/lib/moduleBridge.js): a quiet, inline "this input came from
// another module" note that sits in the input's label row and adds no
// vertical space to the form — it tags the input rather than competing with
// it. It only explains where the value came from; the receiving pages
// already carry their own privacy language (e.g. TOTP's "the secret never
// leaves your browser"), so the tag doesn't repeat assurances.
//
// Receiving pages gate visibility on content equality — `<pending && input
// === pending.value>` — so the tag follows the value: it is shown only while
// the box still holds the exact payload that was handed over, and
// disappears the moment the user edits, clears, or replaces it (typing,
// Reset, "Random secret", loading an example…). Provenance claims about a
// value that is no longer in the box would be misleading.
export default function ReceivedPayload({ from }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-teal" />
      Pre-filled from {from ?? "another module"}
    </span>
  );
}