import type {
  ChatMessage,
  CoachChatContext,
  JobAnalysis,
  JobPosting,
  JobStatusMap,
  OptimizeDocument,
  OptimizeJobData,
  ProfileData,
  ResumeData,
  ResumeRewrite,
  StarterPrompt,
} from "@/types/coach";

export const ENABLE_MOCK_DATA = process.env.NODE_ENV === "development";

const profileSeed: ProfileData = {
  fullName: "Pietro Sarmiento",
  location: "Toronto, ON",
  workPermit: "Open work permit in Canada, no sponsorship required",
  languages: ["English", "Spanish"],
  desiredIndustries: ["AI SaaS", "Developer Tools", "Fintech"],
  desiredRoles: ["Product Manager", "Growth Product Manager"],
  activeResumeId: "resume_v1",
};

const emptyProfile: ProfileData = {
  fullName: "",
  location: "",
  workPermit: "",
  languages: [],
  desiredIndustries: [],
  desiredRoles: [],
  activeResumeId: "",
};

const currentResumeSeed: ResumeData = {
  id: "resume_v1",
  fileName: "",
  uploadedAt: "",
  summary: "",
  experience: [],
  skills: [],
};

const emptyResume: ResumeData = {
  id: "",
  fileName: "",
  uploadedAt: "",
  summary: "",
  experience: [],
  skills: [],
};

export const profile: ProfileData = ENABLE_MOCK_DATA ? profileSeed : emptyProfile;
export const currentResume: ResumeData = ENABLE_MOCK_DATA ? currentResumeSeed : emptyResume;
export const jobs: JobPosting[] = ENABLE_MOCK_DATA ? [] : [];
export const jobStatuses: JobStatusMap = ENABLE_MOCK_DATA ? {} : {};

export {
  getStoredJobStatuses,
  saveJobStatuses,
  getStoredJobStatusTimestamps,
  saveJobStatusTimestamps,
  setStoredJobStatus,
  getJobApplicationNotes,
  getJobApplicationNote,
  setJobApplicationNote,
  type JobStatusTimestampMap,
  type JobApplicationNotesMap,
} from "@/lib/job-pipeline-store";

export const analyses: JobAnalysis[] = ENABLE_MOCK_DATA ? [] : [];

const rewritePreviewSeed: ResumeRewrite[] = [];

export const rewritePreview: ResumeRewrite[] = ENABLE_MOCK_DATA
  ? rewritePreviewSeed
  : [];

const emptyOptimizeDocument: OptimizeDocument = {
  name: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  workEligibility: "",
  languages: [],
  summary: "",
  education: [],
  experience: [],
  tools: [],
  other: [],
};

const originalDocumentSeed: OptimizeDocument = emptyOptimizeDocument;

export const originalDocument: OptimizeDocument = ENABLE_MOCK_DATA
  ? originalDocumentSeed
  : emptyOptimizeDocument;

export const optimizeByJob: Record<string, OptimizeJobData> = ENABLE_MOCK_DATA
  ? {}
  : {};

const chatSeedData: ChatMessage[] = [];

export const chatSeed: ChatMessage[] = ENABLE_MOCK_DATA ? chatSeedData : [];

const starterPromptsSeed: StarterPrompt[] = [];

export const starterPrompts: StarterPrompt[] = ENABLE_MOCK_DATA
  ? starterPromptsSeed
  : [];

function isInterviewHelpRequest(userRequest: string): boolean {
  const normalized = userRequest.toLowerCase();
  const interviewTriggers = [
    "interview questions",
    "interview prep",
    "practice interview",
    "sample interview questions",
    "mock interview",
    "interview practice",
    "help me prep for interviews",
    "interview",
  ];
  return interviewTriggers.some((trigger) => normalized.includes(trigger));
}

function detectInterviewPracticeMode(
  userRequest: string,
): "general" | "role-specific" | null {
  const normalized = userRequest.toLowerCase();

  const isGeneral =
    normalized.includes("general interview") ||
    normalized.includes("general practice") ||
    normalized.includes("generic interview") ||
    normalized.includes("not role specific");
  if (isGeneral) {
    return "general";
  }

  const referencesSpecificRole =
    normalized.includes("role-specific") ||
    normalized.includes("specific role") ||
    normalized.includes("this role") ||
    jobs.some(
      (job) =>
        normalized.includes(job.title.toLowerCase()) ||
        normalized.includes(job.company.toLowerCase()),
    );
  if (referencesSpecificRole) {
    return "role-specific";
  }

  return null;
}

export function buildCoachContext(
  userRequest: string,
  statuses: JobStatusMap = jobStatuses,
): CoachChatContext {
  const isInterviewFlow = isInterviewHelpRequest(userRequest);
  const interviewPracticeMode = detectInterviewPracticeMode(userRequest);
  const shouldAskInterviewModeChoice =
    isInterviewFlow && interviewPracticeMode === null;
  const shouldPrioritizeInterviewJobs =
    isInterviewFlow && interviewPracticeMode !== "general";
  const allTrackedJobs = jobs.map((job) => job.id);

  if (!isInterviewFlow) {
    return {
      primaryJobId: allTrackedJobs[0] ?? null,
      prioritizedJobIds: allTrackedJobs,
      fallbackMessage: null,
      shouldPrioritizeInterviewJobs,
      isInterviewFlow,
      interviewPracticeMode,
      shouldAskInterviewModeChoice,
    };
  }

  if (interviewPracticeMode === "general") {
    return {
      primaryJobId: null,
      prioritizedJobIds: [],
      fallbackMessage: null,
      shouldPrioritizeInterviewJobs,
      isInterviewFlow,
      interviewPracticeMode,
      shouldAskInterviewModeChoice,
    };
  }

  const interviewJobIds = jobs
    .filter((job) => statuses[job.id] === "For Interview")
    .map((job) => job.id);

  if (interviewJobIds.length === 0) {
    return {
      primaryJobId: null,
      prioritizedJobIds: [],
      fallbackMessage: "You don’t have any roles marked as For Interview yet.",
      shouldPrioritizeInterviewJobs,
      isInterviewFlow,
      interviewPracticeMode,
      shouldAskInterviewModeChoice,
    };
  }

  return {
    primaryJobId: interviewJobIds[0],
    prioritizedJobIds: interviewJobIds,
    fallbackMessage: null,
    shouldPrioritizeInterviewJobs,
    isInterviewFlow,
    interviewPracticeMode,
    shouldAskInterviewModeChoice,
  };
}
