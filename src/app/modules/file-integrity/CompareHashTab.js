"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { computeHashes, BIG_FILE_SUGGESTION_BYTES } from "@/lib/hashing";
import { saveActivity } from "@/lib/api";
import FallbackCommands from "./FallbackCommands";
import HashProgress from "./HashProgress";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import FileInput from "@/components/FileInput";
import InlineError from "@/components/InlineError";
import { Button } from "@/components/Button";

const LENGTH_TO_ALGORITHM = {
  32: "MD5",
  40: "SHA-1",
  64: "SHA-256",
  96: "SHA-384",
  128: "SHA-512",
};

function detectAlgorithm(hashString) {
  const cleaned = hashString.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(cleaned)) return null;
  return LENGTH_TO_ALGORITHM[cleaned.length] || null;
}

function getExplanation(matches) {
  if (matches) {
    return {
      means:
        "Your file is byte-for-byte identical to what the hash's source published. It was not corrupted or altered during download/transfer.",
      doesntMean: null,
      action: "You can proceed with confidence that this file matches the original.",
    };
  }
  return {
    means:
      "Your file differs from what was expected. This could mean the download was incomplete, got corrupted in transit, or — less commonly — was tampered with.",
    doesntMean:
      "A mismatch alone doesn't confirm malicious intent — corruption during download is a far more common cause.",
    action:
      "Re-download the file from the original source and check again. Do not open or run this file until it matches.",
  };
}

export default function CompareHashTab({ moduleId }) {
  const [file, setFile] = useState(null);
  const [pastedHash, setPastedHash] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState(null);

  const detectedAlgo = detectAlgorithm(pastedHash);

  function resetForm() {
    setFile(null);
    setPastedHash("");
    setResult(null);
    setError(null);
    setProgress(null);
  }

  function handleFileChange(selected) {
    setFile(selected || null);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  function handleHashChange(e) {
    setPastedHash(e.target.value);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  async function handleCompare() {
    if (!file) return;
    if (!pastedHash.trim()) {
      setError("Paste a hash to compare against.");
      return;
    }
    if (!detectedAlgo) {
      setError(
        "This doesn't look like a valid MD5, SHA-1, SHA-256, SHA-384, or SHA-512 hash."
      );
      return;
    }

    setError(null);
    setIsComparing(true);
    setResult(null);
    setProgress(null);

    try {
      const hashes = await computeHashes(file, [detectedAlgo], {
        onProgress: (p) => setProgress(p),
      });
      const computed = hashes[detectedAlgo].toLowerCase();
      const pasted = pastedHash.trim().toLowerCase();
      const matches = computed === pasted;

      setResult({
        algorithm: detectedAlgo,
        computed,
        pasted,
        matches,
      });

      saveActivity({
        moduleType: moduleId,
        summary: `Compared a file against a provided ${detectedAlgo} hash — ${
          matches ? "match" : "mismatch"
        }`,
        details: {
          action: "compare-to-hash",
          algorithm: detectedAlgo,
          fileSize: file.size,
          matches,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <GuidedCard
        icon={Scale}
        heading="Compare a hash"
        description={
          "Paste a known hash (from a download page, vendor site, or previous " +
          "scan) and upload the file to check if they match. The algorithm is " +
          "detected automatically from the hash length."
        }
      />

      <div className="mb-4">
        <FileInput file={file} onChange={handleFileChange} />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Paste the hash you want to compare against
        </label>
        <input
          type="text"
          value={pastedHash}
          onChange={handleHashChange}
          placeholder="e.g. 24cc7e0d9e28b4ff32b4f097f2fc816a..."
          className="w-full border border-slate/30 rounded-lg px-3 py-2 text-sm font-mono text-ink bg-surface focus:outline-none focus:border-teal transition"
        />
        {pastedHash.trim() && (
          <p className="text-xs text-slate mt-1">
            {detectedAlgo
              ? `Detected algorithm: ${detectedAlgo}`
              : "Algorithm not recognized yet — check the hash length."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={handleCompare}
          disabled={!file || isComparing}
          loading={isComparing}
          loadingLabel="Comparing..."
        >
          Compare
        </Button>

        {(file || pastedHash || result || error) && (
          <Button variant="ghost" resetIcon onClick={resetForm}>
            Reset
          </Button>
        )}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      {isComparing && progress && <HashProgress done={progress.done} total={progress.total} />}

      {file && detectedAlgo && file.size > BIG_FILE_SUGGESTION_BYTES && (
        <FallbackCommands
          algorithm={detectedAlgo}
          filenames={[file.name]}
          extraNote={`Compare the command's output to the hash you pasted: ${pastedHash.trim()}`}
        />
      )}

      {result && (
        <div className="mt-6">
          <ResultCard
            verdict={result.matches ? "match" : "mismatch"}
            heading={result.matches ? "Hashes match" : "Hashes do not match"}
            details={[
              { label: "Algorithm", value: result.algorithm },
              { label: "Computed", value: result.computed, mono: true, copyable: true, primary: true },
              { label: "Pasted", value: result.pasted, mono: true, copyable: true, primary: true },
            ]}
            explanation={getExplanation(result.matches)}
          />
        </div>
      )}
    </div>
  );
}
