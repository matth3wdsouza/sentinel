import { describe, it, expect, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import useInspector from "@/lib/useInspector";

// Minimal renderHook stand-in: mount a component that surfaces the hook's
// return value, and drive state updates through it inside act().
function renderInspector(props = {}) {
  const { onAnalyse = vi.fn(), ...opts } = props;
  const latest = { current: null };

  function Harness() {
    latest.current = useInspector({ onAnalyse, ...opts });
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness));
  });

  return {
    current() {
      return latest.current;
    },
    onAnalyse,
    change(value) {
      act(() => {
        latest.current.handleChange({ target: { value } });
      });
    },
    analyse() {
      act(() => {
        latest.current.handleAnalyse();
      });
    },
    load(example) {
      act(() => {
        latest.current.loadExample(example);
      });
    },
    reset() {
      act(() => {
        latest.current.reset();
      });
    },
    toggle(index) {
      act(() => {
        latest.current.toggle(index);
      });
    },
    setResult(value) {
      act(() => {
        latest.current.setResult(value);
      });
    },
    setError(value) {
      act(() => {
        latest.current.setError(value);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useInspector", () => {
  it("starts empty", () => {
    const r = renderInspector();
    const api = r.current();
    expect(api.input).toBe("");
    expect(api.result).toBeNull();
    expect(api.error).toBeNull();
    expect(api.expanded).toEqual({});
    expect(api.canAnalyse).toBe(false);
    expect(api.showReset).toBe(false);
    r.unmount();
  });

  it("updates input on change and flips the action flags", () => {
    const r = renderInspector();
    r.change("hello");
    expect(r.current().input).toBe("hello");
    expect(r.current().canAnalyse).toBe(true);
    expect(r.current().showReset).toBe(true);
    r.unmount();
  });

  it("clears result and error on change", () => {
    const r = renderInspector();
    r.setResult({ verdict: "dangerous" });
    r.setError("boom");
    expect(r.current().result).toEqual({ verdict: "dangerous" });
    expect(r.current().error).toBe("boom");
    r.change("new input");
    expect(r.current().result).toBeNull();
    expect(r.current().error).toBeNull();
    r.unmount();
  });

  it("calls onAnalyse with the raw input", () => {
    const onAnalyse = vi.fn();
    const r = renderInspector({ onAnalyse });
    r.change("some value");
    r.analyse();
    expect(onAnalyse).toHaveBeenCalledTimes(1);
    expect(onAnalyse).toHaveBeenCalledWith("some value");
    r.unmount();
  });

  it("trims the input before analysis when trim is set", () => {
    const onAnalyse = vi.fn();
    const r = renderInspector({ onAnalyse, trim: true });
    r.change(" padded ");
    expect(r.current().input).toBe(" padded ");
    expect(r.current().canAnalyse).toBe(true);
    r.analyse();
    expect(onAnalyse).toHaveBeenCalledWith("padded");
    r.unmount();
  });

  it("does not analyse while the input is empty", () => {
    const onAnalyse = vi.fn();
    const r = renderInspector({ onAnalyse });
    r.analyse();
    expect(onAnalyse).not.toHaveBeenCalled();
    r.unmount();
  });

  it("passes whitespace through untouched unless trim is set", () => {
    const onAnalyse = vi.fn();
    const r = renderInspector({ onAnalyse });
    r.change("   ");
    r.analyse();
    expect(onAnalyse).toHaveBeenCalledWith("   ");
    r.unmount();
  });

  it("loadExample fills the field and clears previous state", () => {
    const r = renderInspector();
    r.setResult({ verdict: "clean" });
    r.setError("nope");
    r.toggle(2);
    r.load({ text: "example text", label: "x" });
    expect(r.current().input).toBe("example text");
    expect(r.current().result).toBeNull();
    expect(r.current().error).toBeNull();
    expect(r.current().expanded).toEqual({});
    r.unmount();
  });

  it("reset clears everything", () => {
    const r = renderInspector();
    r.change("abc");
    r.setResult({ verdict: "clean" });
    r.setError("nope");
    r.toggle(1);
    r.reset();
    expect(r.current().input).toBe("");
    expect(r.current().result).toBeNull();
    expect(r.current().error).toBeNull();
    expect(r.current().expanded).toEqual({});
    expect(r.current().canAnalyse).toBe(false);
    expect(r.current().showReset).toBe(false);
    r.unmount();
  });

  it("toggle marks an index open and closes it on a second call", () => {
    const r = renderInspector();
    r.toggle(0);
    expect(r.current().expanded).toEqual({ 0: true });
    r.toggle(2);
    expect(r.current().expanded).toEqual({ 0: true, 2: true });
    r.toggle(0);
    expect(r.current().expanded).toEqual({ 0: false, 2: true });
    r.unmount();
  });

  it("clearExpanded empties the expanded map", () => {
    const r = renderInspector();
    r.toggle(3);
    act(() => {
      r.current().clearExpanded();
    });
    expect(r.current().expanded).toEqual({});
    r.unmount();
  });

  it("showReset reflects a stored result or error", () => {
    const r = renderInspector();
    r.setResult({ verdict: "dangerous" });
    expect(r.current().showReset).toBe(true);
    r.reset();
    r.setError("boom");
    expect(r.current().showReset).toBe(true);
    r.unmount();
  });
});