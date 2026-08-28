"use client";

import { useState, useEffect, useRef } from "react";
import CompanionLinks from "@/components/CompanionLinks";
import { Hash, Info } from "lucide-react";
import { computeHashes } from "@/lib/hashing";
import { usePreference } from "@/lib/usePreference";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import AlgorithmPicker from "@/components/AlgorithmPicker";
import CopyButton from "@/components/CopyButton";
import InlineError from "@/components/InlineError";

// computeHashes accepts any Blob/File and streams it in chunks. Wrap the
// UTF-8-encoded string in a Blob so the shared lib works unchanged.
function stringToBlob(str) {
  return new Blob([new TextEncoder().encode(str)]);
}

// HashTable — bare card layout for hash results. A hash is a lookup table,
// not a verdict, so the teal rail + "Hash computed ✓" framing of ResultCard
// would be misleading. The explanation is still accessible via an info button.
function HashRow({ algo, hash }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-slate/10 last:border-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate mb-1">{algo}</p>
        <p className="text-xs font-mono text-ink break-all leading-relaxed">{hash}</p>
      </div>
      <CopyButton value={hash} label={`${algo} hash`} className="mt-2 p-2" />
    </div>
  );
}

function HashTable({ results }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">
          Hash values
        </p>
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-label="What this means"
          aria-expanded={showHelp}
          className="rounded-full border border-slate/30 size-7 flex items-center justify-center text-slate hover:text-teal hover:border-teal transition"
        >
          <Info size={13} />
        </button>
      </div>
      {showHelp && (
        <div className="px-5 py-4 border-b border-slate/10 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate font-medium">What this means</p>
            <p className="text-sm text-ink mt-0.5">Each value is a fixed-length fingerprint of the exact bytes in your input. The same input always produces the same hash; changing even a single character produces a completely different one.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate font-medium">What this doesn&apos;t mean</p>
            <p className="text-sm text-ink mt-0.5">A hash is not encryption — it cannot be reversed to recover the original text, and it does not hide or protect it.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate font-medium">What to do</p>
            <p className="text-sm text-ink mt-0.5">Use these values to verify that two strings are identical, or to compare against a published checksum. For security-sensitive work, prefer SHA-256, SHA-384, or SHA-512.</p>
          </div>
        </div>
      )}
      {Object.entries(results).map(([algo, hash]) => (
        <HashRow key={algo} algo={algo} hash={hash} />
      ))}
    </>
  );
}

export default function TextHashPage() {
  const moduleId = useModuleId();
  const [text, setText] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  // Coalescing anchor for activity entries (see the effect below).
  const lastLogRef = useRef(null);
  // Guard against stale async results: hashing now runs in a worker, so if
  // the text changes while a previous hash is still in flight, only the
  // latest request may update the UI (or the activity log).
  const requestRef = useRef(0);

  // Persist algorithm selection across sessions — same pattern as other modules.
  const [selectedAlgos, setSelectedAlgos, algosLoading] = usePreference(
    "text-hash.selectedAlgos",
    ["SHA-256"]
  );

  // Auto-compute with a 350ms debounce after text or algorithm changes.
  // This feels instant for normal typing but avoids hammering the crypto
  // API on every keystroke for long inputs with multiple algorithms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || selectedAlgos.length === 0 || algosLoading) {
      // Invalidate any in-flight compute, then clear on the next tick so the
      // setState isn't synchronous inside the effect body.
      requestRef.current += 1;
      debounceRef.current = setTimeout(() => {
        setResults(null);
        setError(null);
      }, 0);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestRef.current;
      try {
        const hashes = await computeHashes(stringToBlob(text), selectedAlgos);
        if (requestId !== requestRef.current) return;
        setResults(hashes);
        setError(null);

        // Hashing runs continuously (once per pause in typing), so activity
        // entries are coalesced — only log when the length bucket or
        // algorithm set changed, or the last entry was over 30s ago.
        // Otherwise one document would produce dozens of near-identical rows.
        // Digests are deliberately never persisted (see AGENTS.md invariant).
        const now = Date.now();
        const lengthBucket = Math.round(text.length / 8) * 8;
        const algoKey = selectedAlgos.join(",");
        const lastLog = lastLogRef.current;
        const shouldLog =
          !lastLog ||
          lastLog.algoKey !== algoKey ||
          lastLog.lengthBucket !== lengthBucket ||
          now - lastLog.at > 30000;
        if (shouldLog) {
          lastLogRef.current = { algoKey, lengthBucket, at: now };
          saveActivity({
            moduleType: moduleId,
            summary: `Hashed a ${text.length}-character string`,
            details: {
              charCount: text.length,
              algorithms: selectedAlgos,
            },
          });
        }
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err.message);
        setResults(null);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [text, selectedAlgos, algosLoading, moduleId]);

  function toggleAlgo(algo) {
    setSelectedAlgos((prev) =>
      prev.includes(algo) ? prev.filter((a) => a !== algo) : [...prev, algo]
    );
  }

  function handleTextChange(e) {
    setText(e.target.value);
  }

  function resetForm() {
    setText("");
    setResults(null);
    setError(null);
  }

  const byteCount = new TextEncoder().encode(text).length;
  const showReset = text || results || error;

  return (
    <ModulePage
      icon={Hash}
      title="Text Hash Generator"
      description="Type or paste any string and instantly see its cryptographic hash across multiple algorithms."
    >
      {/* Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" htmlFor="text-input">
          Text to hash
        </label>
        <textarea
          id="text-input"
          value={text}
          onChange={handleTextChange}
          placeholder="Paste or type any string…"
          rows={4}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg border border-slate/20 bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-slate font-mono resize-y focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        {text.length > 0 && (
          <p className="text-xs text-slate mt-1">
            {text.length.toLocaleString()} char{text.length !== 1 ? "s" : ""}{" "}
            &middot;{" "}
            {byteCount.toLocaleString()} byte{byteCount !== 1 ? "s" : ""} (UTF-8)
          </p>
        )}
      </div>

      {/* Algorithm selector */}
      <div className="mb-5">
        <AlgorithmPicker
          selected={selectedAlgos}
          onToggle={toggleAlgo}
          open={showLegacy}
          onOpenChange={setShowLegacy}
        />
      </div>

      {/* Error */}
      {error && <InlineError className="mt-4">{error}</InlineError>}

      {showReset && (
        <button
          onClick={resetForm}
          className="flex items-center gap-1.5 text-sm text-slate hover:text-teal transition mt-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset
        </button>
      )}

      {/* Results */}
      {results && (
        <div className="mt-6">
          <ResultCard variant="bare">
            <HashTable results={results} />
          </ResultCard>
        </div>
      )}

      <CompanionLinks
        className="mt-6"
        links={[
          { href: "/modules/file-integrity", label: "Need to hash a file instead?" },
        ]}
      />
    </ModulePage>
  );
}
