/**
 * Audit catalog for Coach Chris browser persistence.
 *
 * Alpha-scoped keys: `coachChris:{namespace}:{resource}` in localStorage.
 * Session namespace: `coachChris:active-alpha-session` in sessionStorage.
 */

export const ALPHA_SCOPED_STORAGE_RESOURCES = [
  "resume", // legacy single-resume blob (migrated to resumes[])
  "resumes", // resume versions
  "active-resume-id",
  "profile", // includes activeResumeId mirror
  "jobs",
  "removed-jobs",
  "analyzed-jobs",
  "analyses",
  "selected-job",
  "pending-analysis-job",
  "pending-analysis-resume-id",
  "job-statuses",
  "job-status-timestamps",
  "job-application-notes",
  "usage-logs",
  "resume-parse-feedback",
  "pending-parse-draft",
  "pending-tailored-drafts",
  "job-import-feedback",
  "chris-chat",
  "storage-meta",
] as const;

export type AlphaScopedStorageResource = (typeof ALPHA_SCOPED_STORAGE_RESOURCES)[number];

/** Global localStorage keys (not alpha-namespaced). */
export const GLOBAL_BROWSER_STORAGE_KEYS = {
  adminAccess: "coachAdminAccess",
  alphaCode: "alphaCode",
  providerConfig: "career-coach.ai-provider-config",
} as const;

export const SESSION_BROWSER_STORAGE_KEYS = {
  activeAlphaSession: "coachChris:active-alpha-session",
} as const;

// TODO: Cross-tab localStorage synchronization (storage events + conflict resolution).
// TODO: Admin namespace isolation cleanup for shared admin-pietro sessions.
