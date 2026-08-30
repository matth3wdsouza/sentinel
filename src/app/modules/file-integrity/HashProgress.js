import { formatBytes } from "@/lib/format";

// Reads a streamed hash's progress (bytes done/total) and renders a bar.
// Only mounted while hashing is in flight; the worker throttles progress
// messages so this doesn't re-render more than a few times a second.
export default function HashProgress({ done, total }) {
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 100;
  return (
    <div className="mt-4" role="status" aria-live="polite">
      <div className="h-2 rounded-full bg-slate/20 overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate mt-1">
        Hashing {formatBytes(done)} of {formatBytes(total)} &middot; {percent}%
      </p>
    </div>
  );
}
