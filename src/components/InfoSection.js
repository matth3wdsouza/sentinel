// InfoSection — the shared "uppercase label + body" pair used for the
// explanation blocks in ResultCard, GeneratorResultCard, text-hash and
// guessability. Spacing is deliberately left to the parent so each caller
// keeps its own rhythm (space-y-3 on a wrapper, or ResultCard's
// mt-3 first:mt-0 approach).
export default function InfoSection({ label, text }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate font-medium">{label}</p>
      <p className="text-sm text-ink mt-0.5">{text}</p>
    </div>
  );
}