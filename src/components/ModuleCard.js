import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ACCENTS } from "@/lib/moduleAccents";

export default function ModuleCard({ module }) {
  const Icon = module.icon;
  const { chipBg, chipText } = ACCENTS[module.accent];

  return (
    <Link
      href={module.path}
      className="group block p-5 rounded-xl bg-surface shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className={`inline-flex p-2 rounded-lg shrink-0 ${chipBg} ${chipText}`}>
          <Icon size={17} />
        </span>
        <h3 className="font-display font-semibold text-ink flex items-center gap-1">
          {module.title}
          <ArrowRight
            size={13}
            className="text-teal opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
          />
        </h3>
      </div>
      <p className="text-sm text-slate leading-relaxed">{module.description}</p>
    </Link>
  );
}
