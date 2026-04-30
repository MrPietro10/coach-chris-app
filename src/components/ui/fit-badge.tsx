import { fitColor, getFitBand, getFitMeta } from "@/utils/fit";
import type { FitCategory } from "@/types/coach";

export function FitBadge({
  fit,
  score,
}: {
  fit: FitCategory;
  score?: number;
}) {
  const meta = getFitMeta(fit);
  const fitBand = score !== undefined ? getFitBand(score) : null;

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${fitColor(fit)}`}
    >
      {score !== undefined ? `Fit ${score} (${fitBand})` : meta.shortLabel}
      {score !== undefined && (
        <span className="sr-only">{meta.shortLabel}</span>
      )}
    </span>
  );
}
