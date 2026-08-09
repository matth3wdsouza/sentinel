"use client";

import { useEffect } from "react";

export default function DragGuard() {
  useEffect(() => {
    function preventDefault(e) {
      // Only suppress the default for file drags — dropping a file outside a
      // drop zone would otherwise navigate the browser away. Text drag-and-drop
      // into inputs/textareas keeps its native behaviour.
      if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
        e.preventDefault();
      }
    }

    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);

    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  return null;
}
