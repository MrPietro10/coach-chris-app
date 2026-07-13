/**
 * PDF export readiness audit (Coach Chris alpha).
 *
 * Current state:
 * - DOCX export is client-side via `docx` and is the stable format.
 * - Beta export uses a clean Coach Chris DOCX template and preserves stored resume content.
 * - Exact original PDF layout preservation is not expected yet because PDF parsing produces text,
 *   not a reusable editable document layout.
 * - `jspdf` is installed but unused; no PDF renderer shares DOCX layout logic.
 * - `RESUME_PDF_EXPORT_ENABLED` remains false in resume-export.ts.
 *
 * Recommended approach when enabling PDF:
 * 1. Extract shared `ResumeExportContent` → layout builder used by DOCX and PDF.
 * 2. Prefer `@react-pdf/renderer` or `pdf-lib` with explicit section styles over raw jsPDF
 *    text positioning (bullets, spacing, and page breaks are painful in jsPDF).
 * 3. Keep generation client-side for alpha isolation unless file size forces server conversion.
 *
 * Risks:
 * - Layout drift between DOCX and PDF if built separately.
 * - Font embedding / bullet rendering inconsistencies across browsers.
 * - Larger bundles if adding a second PDF library alongside `docx`.
 * - User expectation of pixel-perfect match to uploaded PDF resumes (not achievable).
 *
 * Recommendation: defer PDF until DOCX export is faithful in production use; ship PDF as a
 * second phase behind the same `ResumeExportContent` source, not a parallel code path.
 *
 * Future path:
 * - Preserve DOCX formatting where possible when the source upload is DOCX.
 * - For PDF uploads, only pursue closer layout matching after a more advanced document pipeline.
 */

export const RESUME_PDF_EXPORT_RECOMMENDATION = {
  enableNow: false,
  preferredApproach: "shared ResumeExportContent layout, @react-pdf/renderer or pdf-lib",
  deferReason:
    "No stable PDF path exists; jspdf is unused and would duplicate layout work already done for DOCX.",
} as const;
