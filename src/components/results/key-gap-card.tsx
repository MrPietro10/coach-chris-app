"use client";

import { useState } from "react";
import type { StructuredKeyGap } from "@/lib/key-gap-format";

function highlightMetricPlaceholders(text: string) {
  const parts = text.split(/(ADD METRIC:[^—]*?)(?=\s*$|—)/);
  return parts.map((part, index) => {
    if (part.startsWith("ADD METRIC:")) {
      return (
        <strong key={index} className="font-semibold text-amber-700">
          {part}
        </strong>
      );
    }
    return part;
  });
}

type KeyGapCardProps = {
  gap: StructuredKeyGap;
};

export function KeyGapCard({ gap }: KeyGapCardProps) {
  const [showMore, setShowMore] = useState(false);
  const canExpand = Boolean(gap.moreDetail);

  return (
    <article className="rounded-lg border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
      <h3 className="text-sm font-semibold leading-snug text-zinc-900">{gap.title}</h3>

      <dl className="mt-2.5 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            What this means
          </dt>
          <dd className="mt-0.5 leading-relaxed text-zinc-700">{gap.whatThisMeans}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">What to do</dt>
          <dd className="mt-0.5 leading-relaxed text-zinc-800">
            {highlightMetricPlaceholders(gap.whatToDo)}
          </dd>
        </div>
      </dl>

      {canExpand ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowMore((open) => !open)}
            className="text-xs font-medium text-sky-800 hover:text-sky-900"
            aria-expanded={showMore}
          >
            {showMore ? "Hide detail" : "More detail"}
          </button>
          {showMore ? (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{gap.moreDetail}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
