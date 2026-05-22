"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { CoachChrisIntro } from "@/components/onboarding/coach-chris-intro";
import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { PageHeader } from "@/components/ui/page-header";

export default function ResumePage() {
  const isClient = useIsClient();
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <CoachChrisIntro variant="full" activeStep={1} />
      <PageHeader
        title="Step 1: Your resume"
        subtitle="Add your resume once. Coach Chris uses your saved version for every job fit analysis."
      />
      <ResumeWorkspace onNotice={setNotice} />
      {notice ? (
        <p className="mt-3 text-xs text-zinc-600">{notice}</p>
      ) : null}
    </>
  );
}
