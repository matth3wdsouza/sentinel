const ACCENTS = {
  blue:   { bg: "bg-accent-blue-light",   text: "text-accent-blue" },
  rose:   { bg: "bg-accent-rose-light",   text: "text-accent-rose" },
  indigo: { bg: "bg-accent-indigo-light", text: "text-accent-indigo" },
  teal:   { bg: "bg-teal-light",          text: "text-teal" },
};

export default function GuidedCard({ icon: Icon, accent = "blue", heading, description, children }) {
  const tokens = ACCENTS[accent] ?? ACCENTS.blue;

  return (
    <div className="rounded-xl bg-surface shadow-card p-5 mb-5">
      <div className="flex items-start gap-3 mb-3">
        <span className={`inline-flex p-2 rounded-full ${tokens.bg} ${tokens.text} shrink-0`}>
          <Icon size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">{heading}</p>
          <p className="text-xs text-slate leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
