import { ACCENTS } from "@/lib/moduleAccents";
import Link from "next/link";

// PageHeader — the accent color carries over from the home screen card so
// clicking a violet Passphrase Generator card lands on a page that still
// reads as the same tool. The top navigation (Home link) is rendered by
// TopBar, not here; PageHeader owns only the identity block (icon + title +
// description).
//
// The description gets a slightly more generous line-height than the default
// prose body so short-but-dense module descriptions don't feel cramped.
export default function PageHeader({ icon: Icon, accent = "teal", title, description }) {
  const { chipBg, chipText } = ACCENTS[accent];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2.5">
        <span className={`inline-flex p-2.5 rounded-xl ${chipBg} ${chipText} shrink-0`}>
          <Icon size={20} />
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight leading-tight">
          {title}
        </h1>
      </div>
      {description && (
        <p className="text-sm sm:text-base text-slate max-w-xl leading-relaxed pl-0.5">
          {description}
        </p>
      )}
    </div>
  );
}
