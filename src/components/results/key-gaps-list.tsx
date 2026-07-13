"use client";

import { useMemo } from "react";
import { KeyGapCard } from "@/components/results/key-gap-card";
import { parseKeyGapList } from "@/lib/key-gap-format";
import type { FitBand } from "@/types/coach";

type KeyGapsListProps = {
  gaps: string[];
  fitBand?: FitBand | null;
};

export function KeyGapsList({ gaps, fitBand }: KeyGapsListProps) {
  const structuredGaps = useMemo(() => parseKeyGapList(gaps), [gaps]);
  const showEncouragement = fitBand === "Medium" || fitBand === "High";

  if (structuredGaps.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-700">
        No major resume gaps flagged—still worth a quick proofread before you apply.
      </p>
    );
  }

  return (
    <>
      {showEncouragement ? (
        <p className="mt-3 text-sm text-sky-900/90">
          You already have meaningful overlap—the items below are refinements, not blockers.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {structuredGaps.map((gap) => (
          <li key={gap.raw}>
            <KeyGapCard gap={gap} />
          </li>
        ))}
      </ul>
    </>
  );
}
