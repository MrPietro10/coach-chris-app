import {
  assessImportExtractionQuality,
  buildProcessedJobDescription,
  type ImportExtractionQuality,
} from "@/lib/job-import-cleanup";
import type { JobDescriptionSection } from "@/lib/job-import-sections";
import { extractJobMetadataFromHtml } from "@/lib/job-url-import-metadata";
import type { JobHtmlExtractionResult } from "@/lib/job-url-import-extractors";
import { logJobUrlImportDiagnostic } from "@/lib/job-url-import";

export type JobImportPostProcessResult = {
  description: string;
  suggestedTitle: string | null;
  company: string | null;
  location: string | null;
  sections: JobDescriptionSection[];
  extractionQuality: ImportExtractionQuality;
  reviewHint: string | null;
  extractor: JobHtmlExtractionResult["extractor"];
  diagnostics: {
    extractedTextLength: number;
    boilerplateLinesRemoved: number;
    inlineBlocksRemoved: number;
    sectionsDetected: number;
    metadataFound: {
      title: boolean;
      company: boolean;
      location: boolean;
    };
    qualityReasons: string[];
  };
};

export function postProcessJobImport(
  extracted: JobHtmlExtractionResult,
  html: string,
  pageUrl: string,
  hostname: string,
): JobImportPostProcessResult {
  const processed = buildProcessedJobDescription(extracted.description);
  const metadata = extractJobMetadataFromHtml(html, pageUrl, extracted.suggestedTitle);

  const title = metadata.title ?? extracted.suggestedTitle;
  const assessment = assessImportExtractionQuality({
    description: processed.description,
    cleanup: processed.cleanup,
    sections: processed.sections,
    metadata: {
      title,
      company: metadata.company,
      location: metadata.location,
    },
  });

  const diagnostics = {
    extractedTextLength: processed.description.length,
    boilerplateLinesRemoved: processed.cleanup.boilerplateLinesRemoved,
    inlineBlocksRemoved: processed.cleanup.inlineBlocksRemoved,
    sectionsDetected: processed.sections.length,
    metadataFound: {
      title: Boolean(title?.trim()),
      company: Boolean(metadata.company?.trim()),
      location: Boolean(metadata.location?.trim()),
    },
    qualityReasons: assessment.reasons,
  };

  if (process.env.NODE_ENV !== "production") {
    logJobUrlImportDiagnostic("extract_success", {
      urlHost: hostname,
      ...diagnostics,
      extractionQuality: assessment.quality,
      extractor: extracted.extractor,
      metadataSources: metadata.sources,
    });
  }

  return {
    description: processed.description,
    suggestedTitle: title,
    company: metadata.company,
    location: metadata.location,
    sections: processed.sections,
    extractionQuality: assessment.quality,
    reviewHint: assessment.reviewHint,
    extractor: extracted.extractor,
    diagnostics,
  };
}
