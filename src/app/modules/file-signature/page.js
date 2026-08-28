"use client";

import { useState } from "react";
import { FileSearch2 } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import FileInput from "@/components/FileInput";
import { Button } from "@/components/Button";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { analyzeFile } from "@/lib/fileSignature";

const DANGEROUS_EXEC_EXTENSIONS = [
  "exe", "dll", "bat", "cmd", "com", "scr", "ps1", "vbs", "vbe", "cpl",
  "msi", "reg", "jar", "apk", "lnk",
];

export default function FileSignaturePage() {
  const moduleId = useModuleId();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleAnalyze() {
    if (!file) return;

    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const analysis = await analyzeFile(file);
      setResult(analysis);

      const execExt = DANGEROUS_EXEC_EXTENSIONS.includes(analysis.declaredExtension);
      saveActivity({
        moduleType: moduleId,
        summary: `File signature verified (${analysis.verdict})`,
        details: {
          sizeBytes: file.size,
          verdict: analysis.verdict,
          declaredExt: analysis.declaredExtension,
          detectedType: analysis.detected?.type ?? null,
          executableExt: execExt,
        },
      });
    } catch (er) {
      setError("Couldn't read this file. Try a different file.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
  }

  const showReset = file || result || error;

  return (
    <ModulePage
      icon={FileSearch2}
      title="File Signature Verifier"
      description="Check the magic bytes of a file against its declared extension to detect spoofed file types."
    >
      <div className="space-y-5">
        <FileInput
          label="File to verify"
          file={file}
          onChange={(f) => {
            setFile(f);
            setResult(null);
            setError(null);
          }}
        />

        {file && (
          <div className="flex items-center gap-4">
            <Button onClick={handleAnalyze} disabled={isAnalyzing} loading={isAnalyzing} loadingLabel="Reading file…">
              Verify
            </Button>
            {showReset && (
              <Button variant="ghost" resetIcon onClick={reset}>
                Reset
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-mismatch">{error}</div>
        )}

        {result && (
          <>
            {result.verdict === "match" && (
              <ResultCard
                verdict="match"
                heading="File type verified"
                explanation={{
                  means: result.message,
                  doesntMean:
                    "Matching magic bytes mean the file IS the type it claims to be. They don't tell you whether the file is safe to open — a legitimate PDF can still contain malicious content.",
                  action: "You can proceed with normal caution for this file type.",
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Declared</span>
                    <p className="font-mono text-xs text-ink font-medium">
                      .{result.declaredExtension}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Detected</span>
                    <p className="text-sm text-ink">{result.detected.type}</p>
                    <p className="text-xs text-slate">{result.detected.description}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Size</span>
                    <p className="font-mono text-xs text-ink">
                      {(result.fileSize ?? 0).toLocaleString()} bytes
                    </p>
                  </div>
                  {result.detected.hex && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate">Magic bytes</span>
                      <p className="font-mono text-xs text-ink">{result.detected.hex}</p>
                    </div>
                  )}
                </div>
              </ResultCard>
            )}

            {result.verdict === "mismatch" && (
              <ResultCard
                verdict="mismatch"
                heading="File type mismatch!"
                explanation={{
                  means: result.message,
                  action:
                    "This file's contents don't match its extension. If you were expecting a " +
                    `${result.declaredExtension?.toUpperCase()} file but got a ${result.detected?.type ?? "different type"}, it may have been ` +
                    "renamed to trick you into opening it. Do NOT open this file if you weren't expecting it.",
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Declared</span>
                    <p className="font-mono text-xs text-mismatch font-medium">
                      .{result.declaredExtension}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Detected</span>
                    <p className="text-sm text-ink">{result.detected?.type ?? "Unknown"}</p>
                    <p className="text-xs text-slate">{result.detected?.description ?? ""}</p>
                  </div>
                  {result.detected?.hex && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate">Magic bytes</span>
                      <p className="font-mono text-xs text-ink">{result.detected.hex}</p>
                    </div>
                  )}
                </div>
              </ResultCard>
            )}

            {result.verdict === "unknown" && (
              <ResultCard
                verdict="neutral"
                heading="Unknown file type"
                explanation={{
                  means:
                    "The magic bytes don't match any signature Sentinel knows about. This is common for plain text files, custom formats, or files with unusual encodings.",
                  doesntMean:
                    "An unknown file type isn't inherently dangerous — many legitimate files use custom formats.",
                  action:
                    "If this file came from an untrusted source and you weren't expecting an unusual format, be cautious.",
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Declared</span>
                    <p className="font-mono text-xs text-ink">
                      {result.declaredExtension ? `.${result.declaredExtension}` : "No extension"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate">Size</span>
                    <p className="font-mono text-xs text-ink">
                      {(result.fileSize ?? 0).toLocaleString()} bytes
                    </p>
                  </div>
                </div>
              </ResultCard>
            )}

            {result.verdict === "empty" && (
              <ResultCard
                verdict="neutral"
                heading="Empty file"
                explanation={{
                  means: "The file contains no data. An empty file can't have magic bytes to verify.",
                }}
              />
            )}
          </>
        )}
      </div>
    </ModulePage>
  );
}
