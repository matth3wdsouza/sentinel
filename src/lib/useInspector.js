"use client";

import { useState } from "react";

// Shared analyser-page state machine for the inspector modules (URL, Unicode,
// Scam, PIN). The page supplies its own analysis+logging logic via
// `onAnalyse`, which receives the raw (or, with `trim`, trimmed) input; the
// hook owns the input/result/error/expanded state and the standard handlers.
// `setResult`/`setError`/`clearExpanded` are returned so each page's
// runAnalysis body can stay exactly as it was.
//
// `initialValue`/`initialResult` seed the state machine's initial state (used
// by the module-bridge hand-offs: a payload arriving from another module is
// rendered into initial state, not set via effects). They only take effect on
// mount, like any useState initial value.
export default function useInspector({ onAnalyse, trim = false, initialValue = "", initialResult = null } = {}) {
  const [input, setInput] = useState(initialValue);
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const value = trim ? input.trim() : input;

  function handleChange(e) {
    setInput(e.target.value);
    setResult(null);
    setError(null);
  }

  function handleAnalyse() {
    if (!value) return;
    onAnalyse?.(value);
  }

  function clearExpanded() {
    setExpanded({});
  }

  function loadExample(example) {
    setInput(example.text);
    setResult(null);
    setError(null);
    clearExpanded();
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    clearExpanded();
  }

  function toggle(index) {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const canAnalyse = value.length > 0;
  const showReset = value.length > 0 || result !== null || error !== null;

  return {
    input,
    setInput,
    result,
    setResult,
    error,
    setError,
    expanded,
    handleChange,
    handleAnalyse,
    loadExample,
    reset,
    toggle,
    clearExpanded,
    canAnalyse,
    showReset,
  };
}