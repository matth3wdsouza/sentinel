"use client";

import { useRef, useState } from "react";
import { Upload, File as FileIcon } from "lucide-react";

export default function FileInput({ label, file, onChange, accept }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    // Only clear the dragging state when the cursor genuinely leaves the
    // drop zone — not when it moves over a child element inside it.
    // relatedTarget is the element the pointer is entering; if it's still
    // inside this button, we stay in dragging state.
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-ink mb-1">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          onChange(e.target.files[0] || null);
          // Reset the input value so re-selecting the same file re-fires change.
          e.target.value = "";
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={label ? `Choose ${label}` : "Choose a file"}
        className={`flex items-center gap-2 w-full border-2 border-dashed rounded-xl px-4 py-3.5 text-sm transition text-left ${
          isDragging
            ? "border-teal bg-teal-light"
            : "border-slate/25 bg-surface hover:border-teal/50"
        }`}
      >
        {file ? (
          <>
            <FileIcon size={16} className="text-teal shrink-0" />
            <span className="truncate text-ink">{file.name}</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-slate shrink-0" />
            <span className="text-slate">
              {isDragging ? "Drop file here" : "Choose a file, or drag one here"}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
