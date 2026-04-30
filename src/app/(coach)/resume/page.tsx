import { InfoCard } from "@/components/ui/info-card";
import { PageHeader } from "@/components/ui/page-header";
import { currentResume } from "@/mock-data/career-coach";

export default function ResumePage() {
  const hasResumeData =
    currentResume.summary.trim().length > 0 ||
    currentResume.skills.length > 0 ||
    currentResume.experience.length > 0;

  return (
    <>
      <PageHeader
        title="Resume"
        subtitle="This is the resume Chris reviews when scoring jobs and suggesting improvements."
      />
      {!hasResumeData ? (
        <InfoCard title="Resume input">
          <p className="text-sm text-zinc-600">Paste your resume here to begin</p>
        </InfoCard>
      ) : (
        <>
          <InfoCard title={currentResume.fileName || "Resume"}>
            {currentResume.uploadedAt && (
              <p className="text-xs text-zinc-500">Uploaded {currentResume.uploadedAt}</p>
            )}
            <p className="mt-2">{currentResume.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {currentResume.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </InfoCard>
          {currentResume.experience.map((item) => (
            <InfoCard key={item.id} title={`${item.role} — ${item.company}`}>
              <p className="text-xs text-zinc-500">{item.timeline}</p>
              <ul className="mt-2 space-y-1">
                {item.highlights.map((h) => (
                  <li key={h} className="relative pl-3 before:absolute before:left-0 before:content-['·']">
                    {h}
                  </li>
                ))}
              </ul>
              {item.missingMetricsPrompt && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                  {item.missingMetricsPrompt}
                </p>
              )}
            </InfoCard>
          ))}
        </>
      )}
    </>
  );
}
