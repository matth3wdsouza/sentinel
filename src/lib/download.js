// Client-side download helpers. All local, no network.
export function downloadCanvas(canvas, filename) {
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}