"use client";

import type { StoredResumeRecord } from "@/lib/resume-store";
import {
  getAnalysisResumeOptionMeta,
  getTailoredResumeLinkMeta,
} from "@/lib/resume-version-display";
import { TailoredResumeLinkLines } from "@/components/resume/tailored-resume-link-lines";

type ResumeVersionMetadataLinesProps = {
  record: StoredResumeRecord;
  activeResumeId?: string | null;
  mostRecentlyUploadedId?: string | null;
  showActiveLabel?: boolean;
};

export function ResumeVersionMetadataLines({
  record,
  activeResumeId = null,
  mostRecentlyUploadedId = null,
  showActiveLabel = true,
}: ResumeVersionMetadataLinesProps) {
  const meta = getAnalysisResumeOptionMeta(record, activeResumeId, {
    mostRecentlyUploadedId,
  });
  const tailoredLink = getTailoredResumeLinkMeta(record);

  return (
    <>
      {meta.uploadedLabel ? <li>{meta.uploadedLabel}</li> : null}
      {meta.lastUpdatedLabel ? <li>{meta.lastUpdatedLabel}</li> : null}
      {meta.isMostRecentlyUploaded ? (
        <li className="font-medium text-sky-800">Most recently uploaded</li>
      ) : null}
      <TailoredResumeLinkLines
        record={record}
        showPrimaryWhenActive={!tailoredLink?.isRemoved}
      />
      {meta.sourceFileLabel ? <li>{meta.sourceFileLabel}</li> : null}
      {showActiveLabel && meta.isActive ? (
        <li className="font-medium text-emerald-800">Current active resume</li>
      ) : null}
    </>
  );
}
