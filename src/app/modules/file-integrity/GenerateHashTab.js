"use client";

import { useState } from "react";
import { computeHashes, BIG_FILE_SUGGESTION_BYTES } from "@/lib/hashing";
import { saveActivity } from "@/lib/api";
import FallbackCommands from "./FallbackCommands";
import HashProgress from "./HashProgress";
import ResultCard from "@/components/ResultCard";
import FileInput from "@/components/FileInput";
import AlgorithmPicker from "@/components/AlgorithmPicker";
import InlineError from "@/components/InlineError";
import { Button } from "@/components/Button";

export default function GenerateHashTab({ moduleId }) {
  const [file, setFile] = useState(null);
  const [selectedAlgos, setSelectedAlgos] = useState(["SHA-256"]);
  const [showLegacy, setShowLegacy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [progress, setProgress] = useState(null);

  function resetForm() {
    setFile(null);
    setSelectedAlgos(["SHA-256"]);
    setShowLegacy(false);
    setResults(null);
    setError(null);
    setProgress(null);
  }

  function toggleAlgo(algo) {
    setSelectedAlgos((prev) =>
      prev.includes(algo) ? prev.filter((a) => a !== algo) : [...prev, algo]
    );
  }

  function handleFileChange(selected) {
    setFile(selected || null);
    setResults(null);
    setError(null);
    setProgress(null);
  }

  async function handleCompute() {
    if (!file) return;
    if (selectedAlgos.length === 0) {
      setError("Select at least one algorithm.");
      return;
    }

    setError(null);
    setIsComputing(true);
    setResults(null);
    setProgress(null);

    try {
      const hashes = await computeHashes(file, selectedAlgos, {
        onProgress: (p) => setProgress(p),
      });
      setResults(hashes);

      saveActivity({
        moduleType: moduleId,
        summary: `Generated ${selectedAlgos.join(", ")} hash for a file`,
        details: {
          action: "generate",
          algorithms: selectedAlgos,
          fileSize: file.size,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsComputing(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <FileInput file={file} onChange={handleFileChange} />
      </div>

      <div className="mb-4">
        <AlgorithmPicker
          selected={selectedAlgos}
          onToggle={toggleAlgo}
          open={showLegacy}
          onOpenChange={setShowLegacy}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={handleCompute}
          disabled={!file || isComputing}
          loading={isComputing}
          loadingLabel="Computing..."
        >
          Compute Hash
        </Button>

        {(file || results || error) && (
          <Button variant="ghost" resetIcon onClick={resetForm}>
            Reset
          </Button>
        )}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      {isComputing && progress && <HashProgress done={progress.done} total={progress.total} />}

      {file && file.size > BIG_FILE_SUGGESTION_BYTES && (
        <div className="mt-4 space-y-4">
          {selectedAlgos.map((algo) => (
            <FallbackCommands
              key={algo}
              algorithm={algo}
              filenames={[file.name]}
            />
          ))}
        </div>
      )}

      {results && (
        <div className="mt-6">
          <ResultCard
            verdict="success"
            heading="Hash generated"
            details={Object.entries(results).map(([algo, hash]) => ({
              label: algo,
              value: hash,
              mono: true,
              copyable: true,
              primary: true,
            }))}
            explanation={{
              means:
                "This value is a unique \"fingerprint\" of your file's exact contents. If you change even one bit of the file, this value changes completely.",
              action:
                "Share this alongside your file so others can verify their copy is identical to yours — for example, in an email, a download page, or a chat message.",
            }}
          />
        </div>
      )}
    </div>
  );
}
