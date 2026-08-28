"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import { computeHashes, BIG_FILE_SUGGESTION_BYTES } from "@/lib/hashing";
import { saveActivity } from "@/lib/api";
import FallbackCommands from "./FallbackCommands";
import HashProgress, { formatBytes } from "./HashProgress";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import FileInput from "@/components/FileInput";
import InlineError from "@/components/InlineError";
import OptionRow from "@/components/OptionRow";
import { Button } from "@/components/Button";

const ALGORITHMS = ["SHA-256", "SHA-384", "SHA-512", "SHA-1", "MD5"];

function getExplanation(result) {
  if (result.matches) {
    return {
      means: "These two files are byte-for-byte identical.",
      doesntMean: null,
      action: "No action needed — treat them as interchangeable copies.",
    };
  }

  if (result.shortCircuited) {
    return {
      means:
        "These files have different sizes, so they can't be identical — we didn't need to examine their contents to know that.",
      doesntMean: null,
      action:
        "If you expected these to be the same file, check that you selected the right ones, or that neither is a partial/incomplete copy.",
    };
  }

  if (!result.sizesMatch) {
    return {
      means:
        "These files have different sizes and different content — two separate signals pointing the same direction, not just one.",
      doesntMean: null,
      action:
        "If you expected these to be identical, check that you selected the right files — a size difference this clear usually means they're not the same file.",
    };
  }

  return {
    means:
      "These files are the same size but differ in content — even a single differing byte produces a completely different hash.",
    doesntMean: null,
    action:
      "If you expected these to be identical, one may be a different version, a corrupted copy, or an unrelated file that happens to share a size.",
  };
}

export default function CompareFilesTab({ moduleId }) {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [algorithm, setAlgorithm] = useState("SHA-256");
  const [showAlgoChoice, setShowAlgoChoice] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  // Combined progress across both parallel file hashes: each hash updates
  // its own fields, and the bar renders the summed bytes/totals.
  const [progress, setProgress] = useState({ doneA: 0, totalA: 0, doneB: 0, totalB: 0 });

  function resetForm() {
    setFileA(null);
    setFileB(null);
    setAlgorithm("SHA-256");
    setShowAlgoChoice(false);
    setResult(null);
    setError(null);
    setProgress({ doneA: 0, totalA: 0, doneB: 0, totalB: 0 });
  }

  function validateFiles() {
    if (!fileA || !fileB) return "Select both files.";
    return null;
  }

  async function runHashComparison() {
    setIsComparing(true);
    setProgress({ doneA: 0, totalA: 0, doneB: 0, totalB: 0 });
    const sizesMatch = fileA.size === fileB.size;
    try {
      const [hashesA, hashesB] = await Promise.all([
        computeHashes(fileA, [algorithm], {
          onProgress: (p) =>
            setProgress((prev) => ({ ...prev, doneA: p.done, totalA: p.total })),
        }),
        computeHashes(fileB, [algorithm], {
          onProgress: (p) =>
            setProgress((prev) => ({ ...prev, doneB: p.done, totalB: p.total })),
        }),
      ]);
      const hashA = hashesA[algorithm];
      const hashB = hashesB[algorithm];
      const matches = hashA === hashB;

      setResult({
        algorithm,
        hashA,
        hashB,
        matches,
        shortCircuited: false,
        sizesMatch,
      });

      saveActivity({
        moduleType: moduleId,
        summary: `Compared two files using ${algorithm} — ${
          matches ? "match" : sizesMatch ? "mismatch" : "mismatch (different sizes)"
        }`,
        details: {
          action: "compare-files",
          algorithm,
          fileSizeA: fileA.size,
          fileSizeB: fileB.size,
          matches,
          shortCircuited: false,
          sizesMatch,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsComparing(false);
    }
  }

  async function handleCompare() {
    const validationError = validateFiles();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setResult(null);

    if (fileA.size !== fileB.size) {
      setResult({
        algorithm: null,
        hashA: null,
        hashB: null,
        matches: false,
        shortCircuited: true,
      });

      saveActivity({
        moduleType: moduleId,
        summary: "Compared two files — different sizes, no match",
        details: {
          action: "compare-files",
          shortCircuited: true,
          sizeA: fileA.size,
          sizeB: fileB.size,
          matches: false,
        },
      });
      return;
    }

    await runHashComparison();
  }

  return (
    <div className="max-w-2xl">
      <GuidedCard
        icon={GitCompare}
        heading="Compare two files"
        description={
          "Upload two files to check whether they are byte-for-byte identical. " +
          "If their sizes differ, the check short-circuits immediately — no " +
          "hashing needed. Nothing leaves your device."
        }
      />

      <div className="mb-4">
        <FileInput
          label="File A"
          file={fileA}
          onChange={(selected) => {
            setFileA(selected);
            setResult(null);
            setError(null);
            setProgress({ doneA: 0, totalA: 0, doneB: 0, totalB: 0 });
          }}
        />
      </div>

      <div className="mb-4">
        <FileInput
          label="File B"
          file={fileB}
          onChange={(selected) => {
            setFileB(selected);
            setResult(null);
            setError(null);
            setProgress({ doneA: 0, totalA: 0, doneB: 0, totalB: 0 });
          }}
        />
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowAlgoChoice((prev) => !prev)}
          className="text-sm text-teal"
        >
          {showAlgoChoice ? "Hide" : "Use a different"} algorithm (default: SHA-256)
        </button>

        {showAlgoChoice && (
          <div className="mt-2 space-y-1">
            {ALGORITHMS.map((algo) => (
              <OptionRow
                key={algo}
                type="radio"
                name="compare-algorithm"
                checked={algorithm === algo}
                onChange={() => setAlgorithm(algo)}
              >
                {algo}
              </OptionRow>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={handleCompare}
          disabled={!fileA || !fileB || isComparing}
          loading={isComparing}
          loadingLabel="Comparing..."
        >
          Compare
        </Button>

        {(fileA || fileB || result || error) && (
          <Button variant="ghost" resetIcon onClick={resetForm}>
            Reset
          </Button>
        )}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      {isComparing &&
        (progress.doneA > 0 || progress.doneB > 0) && (
          <HashProgress
            done={progress.doneA + progress.doneB}
            total={progress.totalA + progress.totalB}
          />
        )}

      {fileA &&
        fileB &&
        (fileA.size > BIG_FILE_SUGGESTION_BYTES ||
          fileB.size > BIG_FILE_SUGGESTION_BYTES) && (
          <FallbackCommands
            algorithm={algorithm}
            filenames={[fileA.name, fileB.name]}
            extraNote="Run this for both files — the two output lines should match if the files are identical."
          />
        )}

      {result && (
        <div className="mt-6">
          <ResultCard
            verdict={result.matches ? "match" : "mismatch"}
            heading={result.matches ? "Files match" : "Files do not match"}
            details={
              result.shortCircuited
                ? [
                    { label: "File A size", value: formatBytes(fileA.size), primary: true },
                    { label: "File B size", value: formatBytes(fileB.size), primary: true },
                  ]
                : [
                    { label: "Algorithm", value: result.algorithm },
                    ...(!result.sizesMatch
                      ? [
                          { label: "File A size", value: formatBytes(fileA.size) },
                          { label: "File B size", value: formatBytes(fileB.size) },
                        ]
                      : []),
                    {
                      label: `File A (${fileA.name})`,
                      value: result.hashA,
                      mono: true,
                      copyable: true,
                      primary: true,
                    },
                    {
                      label: `File B (${fileB.name})`,
                      value: result.hashB,
                      mono: true,
                      copyable: true,
                      primary: true,
                    },
                  ]
            }
            explanation={getExplanation(result)}
          >
            {result.shortCircuited && (
              <button
                onClick={runHashComparison}
                disabled={isComparing}
                className="text-xs text-teal underline"
              >
                {isComparing ? "Hashing..." : "Hash anyway"}
              </button>
            )}
          </ResultCard>
        </div>
      )}
    </div>
  );
}
