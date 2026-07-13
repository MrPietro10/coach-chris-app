"use client";

import type { StoredResumeRecord } from "@/lib/resume-store";
import { getTailoredResumeLinkMeta } from "@/lib/resume-version-display";

type TailoredResumeLinkLinesProps = {
  record: StoredResumeRecord;
  showPrimaryWhenActive?: boolean;
};

export function TailoredResumeLinkLines({
  record,
  showPrimaryWhenActive = true,
}: TailoredResumeLinkLinesProps) {
  const link = getTailoredResumeLinkMeta(record);
  if (!link) return null;

  return (
    <>
      {link.jobTitle ? <li>Job title: {link.jobTitle}</li> : null}
      {link.company ? <li>Company: {link.company}</li> : null}
      {link.isRemoved ? (
        <li className="font-medium text-amber-800">{link.removedNotice}</li>
      ) : showPrimaryWhenActive && link.primaryLabel ? (
        <li>{link.primaryLabel}</li>
      ) : null}
    </>
  );
}
