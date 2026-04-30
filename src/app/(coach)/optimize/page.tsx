"use client";

import { useRef, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AskChrisLink } from "@/components/ui/ask-chris-link";
import {
  jobs,
  optimizeByJob,
  originalDocument,
} from "@/mock-data/career-coach";
import { fitColor } from "@/utils/fit";
import type {
  MetricInput,
  OptimizeChangeNote,
  OptimizeDocument,
  OptimizeJobData,
} from "@/types/coach";

/* ── helpers ── */

function deepCloneDoc(doc: OptimizeDocument): OptimizeDocument {
  return JSON.parse(JSON.stringify(doc));
}

function downloadResumeAsText(doc: OptimizeDocument) {
  const lines: string[] = [
    doc.name,
    `${doc.location} | ${doc.phone} | ${doc.email} | ${doc.linkedin}`,
    doc.workEligibility,
    `Languages: ${doc.languages.join(", ")}`,
    "",
    "PROFESSIONAL SUMMARY",
    doc.summary,
    "",
  ];

  lines.push("EDUCATION");
  for (const edu of doc.education) {
    lines.push(`${edu.school}`);
    lines.push(`${edu.degree} | ${edu.dates}`);
    if (edu.highlights) {
      for (const h of edu.highlights) lines.push(`  • ${h}`);
    }
    lines.push("");
  }

  lines.push("PROFESSIONAL EXPERIENCE");
  for (const entry of doc.experience) {
    lines.push(`${entry.company} (${entry.companyContext})`);
    lines.push(`${entry.role} | ${entry.timeline}`);
    for (const bullet of entry.bullets) lines.push(`  • ${bullet}`);
    lines.push("");
  }

  lines.push("TOOLS & TECHNOLOGIES");
  lines.push(doc.tools.join(", "));
  lines.push("");

  lines.push("OTHER INFORMATION");
  for (const section of doc.other) {
    lines.push(`${section.label}: ${section.items.join("; ")}`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.name.replace(/\s+/g, "-")}-Optimized-Resume.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function readableLabel(id: string, doc: OptimizeDocument) {
  if (id === "summary") return "Summary";
  if (id === "tools") return "Tools & Technologies";
  const match = id.match(/^exp-(\d+)-bullet-(\d+)$/);
  if (match) {
    const entry = doc.experience[parseInt(match[1])];
    return `${entry?.company ?? "Experience"} — bullet ${parseInt(match[2]) + 1}`;
  }
  return id;
}

function parseBulletLocation(changeId: string): {
  expIdx: number;
  bulletIdx: number;
} | null {
  const m = changeId.match(/^exp-(\d+)-bullet-(\d+)$/);
  if (!m) return null;
  return { expIdx: parseInt(m[1]), bulletIdx: parseInt(m[2]) };
}

/* ── sub-components ── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-zinc-300 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-800">
      {children}
    </h3>
  );
}

function ResumeDocument({
  doc,
  variant,
  changedIds,
  activeChangeId,
  onSelectChange,
}: {
  doc: OptimizeDocument;
  variant: "original" | "optimized";
  changedIds?: Set<string>;
  activeChangeId?: string | null;
  onSelectChange?: (id: string) => void;
}) {
  const isOptimized = variant === "optimized";

  function changeableBlock(
    id: string,
    children: React.ReactNode,
    extraClass?: string,
  ) {
    if (!isOptimized || !changedIds?.has(id)) {
      return <div className={extraClass}>{children}</div>;
    }
    const isActive = activeChangeId === id;
    return (
      <button
        type="button"
        onClick={() => onSelectChange?.(id)}
        className={`-mx-3 block w-[calc(100%+24px)] cursor-pointer rounded border-l-2 px-3 text-left transition-colors ${
          isActive
            ? "border-emerald-500 bg-emerald-50/80"
            : "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70"
        } ${extraClass ?? ""}`}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-300/80 bg-white">
      {/* Document badge — small label, not a full bar */}
      <div className="px-7 pt-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isOptimized
              ? "bg-emerald-50 text-emerald-600"
              : "bg-zinc-100 text-zinc-400"
          }`}
        >
          {isOptimized ? "Optimized" : "Original"}
        </span>
      </div>

      <div className="px-7 pb-8 pt-4">
        {/* 1. Header */}
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            {doc.name}
          </h2>
          <p className="mt-1.5 text-[12px] text-zinc-500">
            {doc.location} &nbsp;|&nbsp; {doc.phone} &nbsp;|&nbsp; {doc.email}{" "}
            &nbsp;|&nbsp; {doc.linkedin}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {doc.workEligibility} &nbsp;·&nbsp; {doc.languages.join(", ")}
          </p>
        </div>

        {/* 2. Professional Summary */}
        <div className="mt-6">
          <SectionHeading>Professional Summary</SectionHeading>
          {changeableBlock(
            "summary",
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-700">
              {doc.summary}
            </p>,
          )}
        </div>

        {/* 3. Education */}
        <div className="mt-6">
          <SectionHeading>Education</SectionHeading>
          <div className="mt-2.5 space-y-3">
            {doc.education.map((edu) => (
              <div key={`${edu.school}-${edu.degree}`}>
                <p className="text-sm font-semibold text-zinc-900">
                  {edu.school}
                </p>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] text-zinc-600">{edu.degree}</p>
                  <span className="shrink-0 text-[12px] text-zinc-400">
                    {edu.dates}
                  </span>
                </div>
                {edu.highlights && edu.highlights.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {edu.highlights.map((h) => (
                      <li
                        key={h}
                        className="text-[13px] leading-relaxed text-zinc-500"
                      >
                        <span className="mr-1.5 text-zinc-300">•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Professional Experience */}
        <div className="mt-6">
          <SectionHeading>Professional Experience</SectionHeading>
          <div className="mt-2.5 space-y-5">
            {doc.experience.map((entry, ei) => (
              <div key={`${entry.company}-${entry.role}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {entry.company}
                    <span className="ml-1.5 text-[12px] font-normal text-zinc-400">
                      {entry.companyContext}
                    </span>
                  </p>
                  <span className="shrink-0 text-[12px] text-zinc-400">
                    {entry.timeline}
                  </span>
                </div>
                <p className="text-[13px] italic text-zinc-600">
                  {entry.role}
                </p>
                <ul className="mt-2 space-y-1">
                  {entry.bullets.map((bullet, bi) => {
                    const bulletId = `exp-${ei}-bullet-${bi}`;
                    return (
                      <li key={bulletId}>
                        {changeableBlock(
                          bulletId,
                          <p className="text-sm leading-relaxed text-zinc-700">
                            <span className="mr-1.5 text-zinc-400">•</span>
                            {bullet}
                          </p>,
                          "py-0.5",
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Tools & Technologies */}
        <div className="mt-6">
          <SectionHeading>Tools &amp; Technologies</SectionHeading>
          {changeableBlock(
            "tools",
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-700">
              {doc.tools.join("  ·  ")}
            </p>,
          )}
        </div>

        {/* 6. Other Information */}
        <div className="mt-6">
          <SectionHeading>Other Information</SectionHeading>
          <div className="mt-2.5 space-y-1">
            {doc.other.map((section) => (
              <p
                key={section.label}
                className="text-[13px] leading-relaxed text-zinc-700"
              >
                <span className="font-semibold text-zinc-800">
                  {section.label}:
                </span>{" "}
                {section.items.join("; ")}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplanationPanel({
  changeId,
  note,
  doc,
  onClose,
  panelRef,
}: {
  changeId: string;
  note: OptimizeChangeNote;
  doc: OptimizeDocument;
  onClose: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={panelRef}
      className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-900">
            Why this changed
          </h3>
          <p className="mt-0.5 text-xs text-emerald-700">
            {readableLabel(changeId, doc)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white hover:text-zinc-600"
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            What improved
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            {note.whatChanged}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Why it helps for this role
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            {note.whyItHelps}
          </p>
        </div>
        {note.metricPrompt && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">
              Action needed from you
            </p>
            <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
              {note.metricPrompt}
            </p>
          </div>
        )}
        <div className="border-t border-emerald-200/60 pt-3">
          <AskChrisLink
            prompt={`Tell me more about the "${readableLabel(changeId, doc)}" change. ${note.whatChanged}`}
          >
            Ask Chris about this change
          </AskChrisLink>
        </div>
      </div>
    </section>
  );
}

type Resolution = "reword" | "remove" | "keep";

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
      description: "Delete this bullet entirely from the optimized resume.",
    },
    {
      value: "keep",
      label: isZero ? "Keep as entered" : "Keep placeholder for now",
      description: isZero
        ? "Use 0 as the value. You can change this later."
        : "Leave the placeholder. You can come back to fill it in.",
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
            <span className="block text-sm font-medium text-zinc-800">
              {opt.label}
            </span>
            <span className="block text-xs text-zinc-400">
              {opt.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MetricInputRow({
  metric,
  value,
  onChange,
  onApplySingle,
  stepLabel,
  status,
  onResolve,
}: {
  metric: MetricInput;
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

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        {metric.helpText}
      </p>

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
            {isZero
              ? "You entered 0 — how should this bullet read?"
              : "No value yet — what should Chris do with this bullet?"}
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

/* ── page ── */

const availableJobIds = Object.keys(optimizeByJob);
const DEFAULT_JOB_ID = availableJobIds[0];

function initMetricValues(data: OptimizeJobData): Record<string, string> {
  return Object.fromEntries(data.metricInputs.map((m) => [m.id, ""]));
}

function initMetricStatuses(
  data: OptimizeJobData,
): Record<string, "idle" | "needs_resolution" | "resolved"> {
  return Object.fromEntries(data.metricInputs.map((m) => [m.id, "idle"]));
}

export default function OptimizePage() {
  const [selectedJobId, setSelectedJobId] = useState(DEFAULT_JOB_ID);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"original" | "optimized">(
    "optimized",
  );
  const panelRef = useRef<HTMLElement | null>(null);

  const jobData = optimizeByJob[selectedJobId];

  const [liveDoc, setLiveDoc] = useState<OptimizeDocument>(() =>
    deepCloneDoc(jobData.optimizedDocument),
  );

  const [metricValues, setMetricValues] = useState<Record<string, string>>(
    () => initMetricValues(jobData),
  );
  const [metricStatuses, setMetricStatuses] = useState<
    Record<string, "idle" | "needs_resolution" | "resolved">
  >(() => initMetricStatuses(jobData));

  const handleJobChange = useCallback(
    (newJobId: string) => {
      if (newJobId === selectedJobId) return;
      const nextData = optimizeByJob[newJobId];
      setSelectedJobId(newJobId);
      setActiveChangeId(null);
      setLiveDoc(deepCloneDoc(nextData.optimizedDocument));
      setMetricValues(initMetricValues(nextData));
      setMetricStatuses(initMetricStatuses(nextData));
    },
    [selectedJobId],
  );

  const changedIds = new Set(Object.keys(jobData.changes));
  const activeNote = activeChangeId
    ? jobData.changes[activeChangeId]
    : undefined;

  const currentMetrics = jobData.metricInputs;
  const pendingMetrics = currentMetrics.filter(
    (m) => metricStatuses[m.id] !== "resolved",
  );

  function handleSelectChange(id: string) {
    const nextId = activeChangeId === id ? null : id;
    setActiveChangeId(nextId);
    if (nextId) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }

  function applyMetricToDoc(
    doc: OptimizeDocument,
    metric: MetricInput,
    userValue: string,
  ): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    const bullet = next.experience[loc.expIdx]?.bullets[loc.bulletIdx];
    if (!bullet) return doc;

    const replaced = bullet.replace(
      metric.bulletReplacePattern,
      ` — ${userValue}`,
    );
    next.experience[loc.expIdx].bullets[loc.bulletIdx] = replaced;
    return next;
  }

  function rewordBullet(
    doc: OptimizeDocument,
    metric: MetricInput,
  ): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    next.experience[loc.expIdx].bullets[loc.bulletIdx] = metric.rewordedBullet;
    return next;
  }

  function removeBullet(
    doc: OptimizeDocument,
    metric: MetricInput,
  ): OptimizeDocument {
    const loc = parseBulletLocation(metric.changeId);
    if (!loc) return doc;
    const next = deepCloneDoc(doc);
    next.experience[loc.expIdx].bullets.splice(loc.bulletIdx, 1);
    return next;
  }

  function handleApplySingle(metric: MetricInput) {
    const val = metricValues[metric.id]?.trim() ?? "";

    if (val === "" || val === "0") {
      setMetricStatuses((prev) => ({
        ...prev,
        [metric.id]: "needs_resolution",
      }));
      return;
    }

    const doc = applyMetricToDoc(liveDoc, metric, val);
    setLiveDoc(doc);
    setMetricStatuses((prev) => ({ ...prev, [metric.id]: "resolved" }));
  }

  function handleApplyAll() {
    let doc = deepCloneDoc(liveDoc);
    const nextStatuses = { ...metricStatuses };

    for (const metric of currentMetrics) {
      if (metricStatuses[metric.id] === "resolved") continue;
      const val = metricValues[metric.id]?.trim() ?? "";

      if (val === "" || val === "0") {
        nextStatuses[metric.id] = "needs_resolution";
      } else {
        doc = applyMetricToDoc(doc, metric, val);
        nextStatuses[metric.id] = "resolved";
      }
    }

    setLiveDoc(doc);
    setMetricStatuses(nextStatuses);
  }

  function handleResolve(metric: MetricInput, resolution: Resolution) {
    let doc = deepCloneDoc(liveDoc);
    const val = metricValues[metric.id]?.trim() ?? "";

    switch (resolution) {
      case "reword":
        doc = rewordBullet(doc, metric);
        break;
      case "remove":
        doc = removeBullet(doc, metric);
        break;
      case "keep":
        if (val === "0") {
          doc = applyMetricToDoc(doc, metric, val);
        }
        break;
    }

    setLiveDoc(doc);
    setMetricStatuses((prev) => ({ ...prev, [metric.id]: "resolved" }));
  }

  const job = jobs.find((j) => j.id === selectedJobId);

  return (
    <>
      <PageHeader
        title="Optimize"
        subtitle="Refine your resume to strengthen your positioning for this application."
      />

      {/* Context bar: job selector + fit + actions */}
      <div className="rounded-xl border border-zinc-200/80 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: selector + details */}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="job-selector"
              className="block text-[11px] font-medium uppercase tracking-wide text-zinc-400"
            >
              Optimize for
            </label>

            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="relative min-w-0 flex-1">
                <select
                  id="job-selector"
                  value={selectedJobId}
                  onChange={(e) => handleJobChange(e.target.value)}
                  className="w-full appearance-none truncate rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 focus:border-zinc-400 focus:outline-none"
                >
                  {availableJobIds.map((jid) => {
                    const d = optimizeByJob[jid];
                    return (
                      <option key={jid} value={jid}>
                        {d.targetRole.company} — {d.targetRole.title}
                      </option>
                    );
                  })}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="block"
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${fitColor(jobData.fit)}`}
              >
                {jobData.fit} · {jobData.score}
              </span>
            </div>

            {job && (
              <p className="mt-1.5 text-[12px] text-zinc-400">
                {job.location}
                {job.salaryRange && <> · {job.salaryRange}</>}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 gap-2 pt-5">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Re-optimize
            </button>
            <button
              type="button"
              onClick={() => downloadResumeAsText(liveDoc)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Download optimized resume
            </button>
          </div>
        </div>
      </div>

      {/* Mobile view toggle */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("original")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mobileView === "original"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Original
        </button>
        <button
          type="button"
          onClick={() => setMobileView("optimized")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mobileView === "optimized"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Optimized
        </button>
      </div>

      {/* Desktop: side-by-side / Mobile: toggled */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={mobileView !== "original" ? "hidden lg:block" : ""}>
          <ResumeDocument doc={originalDocument} variant="original" />
        </div>
        <div className={mobileView !== "optimized" ? "hidden lg:block" : ""}>
          <ResumeDocument
            doc={liveDoc}
            variant="optimized"
            changedIds={changedIds}
            activeChangeId={activeChangeId}
            onSelectChange={handleSelectChange}
          />
        </div>
      </div>

      {/* Explanation panel */}
      {activeChangeId && activeNote && (
        <ExplanationPanel
          changeId={activeChangeId}
          note={activeNote}
          doc={jobData.optimizedDocument}
          onClose={() => setActiveChangeId(null)}
          panelRef={panelRef}
        />
      )}

      {/* ── Missing details workflow ── */}
      {pendingMetrics.length > 0 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 px-5 py-4">
            <h3 className="text-sm font-medium text-zinc-900">
              Your input needed
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Chris found{" "}
              <span className="font-medium text-zinc-700">
                {pendingMetrics.length}{" "}
                {pendingMetrics.length === 1 ? "bullet" : "bullets"}
              </span>{" "}
              that would be stronger with a real metric. Add your numbers below
              and the resume will update instantly.
            </p>
          </div>

          {currentMetrics.map((metric, idx) => {
            if (metricStatuses[metric.id] === "resolved") return null;
            return (
              <MetricInputRow
                key={metric.id}
                metric={metric}
                value={metricValues[metric.id] ?? ""}
                onChange={(v) =>
                  setMetricValues((prev) => ({ ...prev, [metric.id]: v }))
                }
                onApplySingle={() => handleApplySingle(metric)}
                stepLabel={`${idx + 1}`}
                status={metricStatuses[metric.id]}
                onResolve={(r) => handleResolve(metric, r)}
              />
            );
          })}

          {pendingMetrics.length > 1 && (
            <button
              type="button"
              onClick={handleApplyAll}
              className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Apply all at once
            </button>
          )}
        </section>
      )}

      {pendingMetrics.length === 0 && (
        <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
              ✓
            </span>
            <h3 className="text-sm font-medium text-emerald-800">
              All details complete
            </h3>
          </div>
          <p className="mt-1.5 text-sm text-emerald-600">
            Every bullet has been finalized. Your optimized resume is ready to
            download.
          </p>
        </section>
      )}

      {/* Change index */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <h3 className="text-sm font-medium text-zinc-900">
          {changedIds.size} changes made
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          Click any highlighted section in the optimized resume to see why it
          was changed
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from(changedIds).map((id) => {
            const hasMetric = jobData.changes[id]?.metricPrompt;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectChange(id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  activeChangeId === id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}
              >
                {readableLabel(id, jobData.optimizedDocument)}
                {hasMetric && (
                  <span className="ml-1 text-amber-500">●</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          <span className="text-amber-500">●</span> = needs a real metric from
          you
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3">
          <AskChrisLink
            prompt={`How can I strengthen my resume for ${jobData.targetRole.title} at ${jobData.targetRole.company}?`}
          >
            How can I strengthen this further?
          </AskChrisLink>
          <AskChrisLink
            prompt={`Is my optimized resume too exaggerated for ${jobData.targetRole.title} at ${jobData.targetRole.company}?`}
          >
            Is anything too exaggerated?
          </AskChrisLink>
        </div>
      </div>
    </>
  );
}
