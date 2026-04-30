"use client";

import { useMemo, useRef, useState } from "react";
import type { MetricInput, OptimizeDocument, OptimizeJobData } from "@/types/coach";

type Resolution = "reword" | "remove" | "keep";
type GapInputType = "metric_missing" | "skill_missing" | "evidence_missing";
type GapAffectedSection = "summary" | "skills" | "experience";

export type GapDrivenInput = {
  id: string;
  type: GapInputType;
  description: string;
  affectedSection: GapAffectedSection;
  label: string;
  helpText: string;
  placeholder: string;
};

function deepCloneDoc(doc: OptimizeDocument): OptimizeDocument {
  return JSON.parse(JSON.stringify(doc));
}

function parseBulletLocation(changeId: string): { expIdx: number; bulletIdx: number } | null {
  const m = changeId.match(/^exp-(\d+)-bullet-(\d+)$/);
  if (!m) return null;
  return { expIdx: parseInt(m[1]), bulletIdx: parseInt(m[2]) };
}

function sanitizePlaceholderText(text: string): string {
  return text
    .replace(/\s*[—-]\s*ADD METRIC:\s*e\.g\.[^.;)]*[.;)]?/gi, "")
    .replace(/\bADD METRIC\b:?/gi, "")
    .replace(/\be\.g\.[^.;)]*[.;)]?/gi, "")
    .replace(/\badd metric here\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeResumeDocForDisplay(doc: OptimizeDocument): OptimizeDocument {
  const next = deepCloneDoc(doc);
  next.summary = sanitizePlaceholderText(next.summary ?? "");
  next.tools = (next.tools ?? []).map((tool) => sanitizePlaceholderText(tool)).filter((tool) => tool.length > 0);
  next.experience = (next.experience ?? []).map((entry) => ({
    ...entry,
    bullets: (entry.bullets ?? [])
      .map((bullet) => sanitizePlaceholderText(bullet))
      .filter((bullet) => bullet.length > 0),
  }));
  return next;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-800">
      {children}
    </h3>
  );
}

function ResumeOptimizedPreview({
  doc,
}: {
  doc: OptimizeDocument;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-300/80 bg-white">
      <div className="px-7 pt-3">
        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
          Optimized
        </span>
      </div>
      <div className="px-7 pb-8 pt-4">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">{doc.name}</h2>
          <p className="mt-1.5 text-[12px] text-zinc-500">
            {doc.location} &nbsp;|&nbsp; {doc.phone} &nbsp;|&nbsp; {doc.email} &nbsp;|&nbsp;{" "}
            {doc.linkedin}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {doc.workEligibility} &nbsp;·&nbsp; {doc.languages.join(", ")}
          </p>
        </div>

        <div className="mt-6">
          <SectionHeading>Professional Summary</SectionHeading>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-700">{doc.summary}</p>
        </div>

        <div className="mt-6">
          <SectionHeading>Professional Experience</SectionHeading>
          <div className="mt-2.5 space-y-5">
            {doc.experience.map((entry) => (
              <div key={`${entry.company}-${entry.role}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {entry.company}
                    <span className="ml-1.5 text-[12px] font-normal text-zinc-400">
                      {entry.companyContext}
                    </span>
                  </p>
                  <span className="shrink-0 text-[12px] text-zinc-400">{entry.timeline}</span>
                </div>
                <p className="text-[13px] italic text-zinc-600">{entry.role}</p>
                <ul className="mt-2 space-y-1">
                  {entry.bullets.map((bullet, idx) => (
                    <li key={`${entry.company}-${idx}`} className="text-sm leading-relaxed text-zinc-700">
                      <span className="mr-1.5 text-zinc-400">•</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <SectionHeading>Tools &amp; Technologies</SectionHeading>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-700">{doc.tools.join("  ·  ")}</p>
        </div>
      </div>
    </div>
  );
}

function ResolutionChoices({
  isZero,
  onChoose,
}: {
  isZero: boolean;
  onChoose: (r: Resolution) => void;
}) {
  const options: { value: Resolution; label: string; description: string }[] = [
    {
      value: "reword",
      label: isZero ? "Reword without a metric" : "Reword this bullet",
      description: "Keep the accomplishment, remove the number placeholder.",
    },
    {
      value: "remove",
      label: isZero ? "Remove the bullet" : "Remove this claim",
      description: "Delete this bullet from the optimized resume.",
    },
    {
      value: "keep",
      label: isZero ? "Keep as entered" : "Keep placeholder for now",
      description: "Leave it for now and come back later.",
    },
  ];

  return (
    <div className="mt-3 space-y-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChoose(opt.value)}
          className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[10px] text-zinc-400">
            {opt.value === "reword" ? "↻" : opt.value === "remove" ? "×" : "—"}
          </span>
          <span>
            <span className="block text-sm font-medium text-zinc-800">{opt.label}</span>
            <span className="block text-xs text-zinc-400">{opt.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MetricInputRow({
  metric,
  gapHint,
  value,
  onChange,
  onApplySingle,
  stepLabel,
  status,
  onResolve,
}: {
  metric: {
    id: string;
    label: string;
    helpText: string;
    placeholder: string;
  };
  gapHint?: string;
  value: string;
  onChange: (v: string) => void;
  onApplySingle: () => void;
  stepLabel: string;
  status: "idle" | "needs_resolution" | "resolved";
  onResolve: (r: Resolution) => void;
}) {
  const needsResolution = status === "needs_resolution";
  const isZero = value.trim() === "0";
  const hasValue = value.trim().length > 0 && value.trim() !== "0";

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">
          {stepLabel}
        </span>
        <h4 className="text-sm font-medium text-zinc-900">{metric.label}</h4>
      </div>

      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Fix this gap:</p>
        <p className="mt-1 text-sm text-zinc-700">
          {gapHint ?? "Strengthen role-relevant evidence for this part of the resume."}
        </p>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{metric.helpText}</p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasValue) onApplySingle();
          }}
          placeholder={metric.placeholder}
          disabled={status === "resolved"}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none disabled:opacity-50"
        />
        {status === "idle" && hasValue && (
          <button
            type="button"
            onClick={onApplySingle}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Apply
          </button>
        )}
      </div>

      {needsResolution && (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/40 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            {isZero ? "You entered 0 — how should this bullet read?" : "No value yet — what should we do?"}
          </p>
          <ResolutionChoices isZero={isZero} onChoose={onResolve} />
        </div>
      )}

      {status === "resolved" && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">
            ✓
          </span>
          Updated in resume
        </div>
      )}
    </div>
  );
}

function initMetricValues(data: OptimizeJobData): Record<string, string> {
  return Object.fromEntries(data.metricInputs.map((m) => [m.id, ""]));
}

function initMetricStatuses(
  data: OptimizeJobData,
): Record<string, "idle" | "needs_resolution" | "resolved"> {
  return Object.fromEntries(data.metricInputs.map((m) => [m.id, "idle"]));
}

export function InlineOptimizeForJob(options: {
  jobData: OptimizeJobData;
  onDocChange: (doc: OptimizeDocument) => void;
  gapByMetricId?: Record<string, string>;
  gapInputs?: GapDrivenInput[];
}) {
  const { jobData, onDocChange, gapByMetricId, gapInputs } = options;
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [liveDoc, setLiveDoc] = useState<OptimizeDocument>(() => deepCloneDoc(jobData.optimizedDocument));
  const [metricValues, setMetricValues] = useState<Record<string, string>>(() =>
    gapInputs
      ? Object.fromEntries(gapInputs.map((item) => [item.id, ""]))
      : initMetricValues(jobData),
  );
  const [metricStatuses, setMetricStatuses] = useState<Record<string, "idle" | "needs_resolution" | "resolved">>(() =>
    gapInputs
      ? Object.fromEntries(gapInputs.map((item) => [item.id, "idle"]))
      : initMetricStatuses(jobData),
  );

  const currentMetrics = gapInputs ?? jobData.metricInputs;
  const pendingMetrics = useMemo(
    () => currentMetrics.filter((m) => metricStatuses[m.id] !== "resolved"),
    [currentMetrics, metricStatuses],
  );
  const displayDoc = useMemo(() => sanitizeResumeDocForDisplay(liveDoc), [liveDoc]);

  function applyMetricToDoc(doc: OptimizeDocument, metric: MetricInput, userValue: string): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    const bullet = next.experience[loc.expIdx]?.bullets[loc.bulletIdx];
    if (!bullet) return doc;
    next.experience[loc.expIdx].bullets[loc.bulletIdx] = bullet.replace(
      metric.bulletReplacePattern,
      ` — ${userValue}`,
    );
    return next;
  }

  function rewordBullet(doc: OptimizeDocument, metric: MetricInput): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    next.experience[loc.expIdx].bullets[loc.bulletIdx] = metric.rewordedBullet;
    return next;
  }

  function removeBullet(doc: OptimizeDocument, metric: MetricInput): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    next.experience[loc.expIdx].bullets.splice(loc.bulletIdx, 1);
    return next;
  }

  function handleApplySingle(metric: MetricInput) {
    const val = metricValues[metric.id]?.trim() ?? "";
    if (val === "" || val === "0") {
      setMetricStatuses((prev) => ({ ...prev, [metric.id]: "needs_resolution" }));
      return;
    }
    const nextDoc = applyMetricToDoc(liveDoc, metric, val);
    setLiveDoc(nextDoc);
    onDocChange(nextDoc);
    setMetricStatuses((prev) => ({ ...prev, [metric.id]: "resolved" }));
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function handleResolve(metric: MetricInput, resolution: Resolution) {
    const val = metricValues[metric.id]?.trim() ?? "";
    let nextDoc = deepCloneDoc(liveDoc);
    switch (resolution) {
      case "reword":
        nextDoc = rewordBullet(nextDoc, metric);
        break;
      case "remove":
        nextDoc = removeBullet(nextDoc, metric);
        break;
      case "keep":
        if (val === "0") nextDoc = applyMetricToDoc(nextDoc, metric, val);
        break;
    }
    setLiveDoc(nextDoc);
    onDocChange(nextDoc);
    setMetricStatuses((prev) => ({ ...prev, [metric.id]: "resolved" }));
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function applyGapInputToDoc(
    doc: OptimizeDocument,
    input: GapDrivenInput,
    value: string,
  ): OptimizeDocument {
    const next = deepCloneDoc(doc);
    const cleanValue = value.trim();
    if (!cleanValue) return next;

    if (input.affectedSection === "summary") {
      const sentence = cleanValue.endsWith(".") ? cleanValue : `${cleanValue}.`;
      if (!next.summary.includes(cleanValue)) {
        next.summary = `${next.summary} ${sentence}`.trim();
      }
      return next;
    }

    if (input.affectedSection === "skills") {
      const skills = cleanValue
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      for (const skill of skills) {
        if (!next.tools.includes(skill)) next.tools.push(skill);
      }
      return next;
    }

    // experience
    const firstExperience = next.experience[0];
    if (!firstExperience) return next;
    const prefix = input.type === "metric_missing" ? "Measured impact" : "Role-relevant evidence";
    const bullet = `${prefix}: ${cleanValue}.`;
    if (!firstExperience.bullets.some((existing) => existing.includes(cleanValue))) {
      firstExperience.bullets.unshift(bullet);
    }
    return next;
  }

  function handleApplyGapInput(input: GapDrivenInput) {
    const val = metricValues[input.id]?.trim() ?? "";
    if (!val) return;
    const nextDoc = applyGapInputToDoc(liveDoc, input, val);
    setLiveDoc(nextDoc);
    onDocChange(nextDoc);
    setMetricStatuses((prev) => ({ ...prev, [input.id]: "resolved" }));
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  return (
    <div ref={panelRef} className="space-y-5">
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h3 className="text-sm font-medium text-zinc-900">Optimize for this role</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Fill in the missing metrics below and your resume preview will update instantly.
        </p>
      </div>

      <ResumeOptimizedPreview doc={displayDoc} />

      {pendingMetrics.length > 0 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 px-5 py-4">
            <h3 className="text-sm font-medium text-zinc-900">Your input needed</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Add your real numbers to strengthen the bullets below. Use 0 if you truly have no metric.
            </p>
          </div>

          {currentMetrics.map((metric, idx) => {
            if (metricStatuses[metric.id] === "resolved") return null;
            const isGapInput = "affectedSection" in metric;
            return (
              <MetricInputRow
                key={metric.id}
                metric={metric}
                gapHint={isGapInput ? metric.description : gapByMetricId?.[metric.id]}
                value={metricValues[metric.id] ?? ""}
                onChange={(v) => setMetricValues((prev) => ({ ...prev, [metric.id]: v }))}
                onApplySingle={() => {
                  if (isGapInput) {
                    handleApplyGapInput(metric);
                    return;
                  }
                  handleApplySingle(metric);
                }}
                stepLabel={`${idx + 1}`}
                status={metricStatuses[metric.id]}
                onResolve={(r) => {
                  if (isGapInput) {
                    setMetricStatuses((prev) => ({ ...prev, [metric.id]: "resolved" }));
                    return;
                  }
                  handleResolve(metric, r);
                }}
              />
            );
          })}
        </section>
      )}

      {pendingMetrics.length === 0 && (
        <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
              ✓
            </span>
            <h3 className="text-sm font-medium text-emerald-800">All details complete</h3>
          </div>
          <p className="mt-1.5 text-sm text-emerald-600">
            Your optimized resume is ready. Re-run analysis to update the fit read.
          </p>
        </section>
      )}
    </div>
  );
}

