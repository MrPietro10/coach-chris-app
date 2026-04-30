export type FitCategory =
  | "No Fit"
  | "Aspirational Fit"
  | "Backup Fit"
  | "Strong Fit";

export type FitBand = "Low" | "Medium" | "High";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export type FitSignal = {
  hasExperience: boolean;
  hasPreference: boolean;
};

export type FitEvaluationInput = FitSignal & {
  score?: number;
  reasoning?: string;
};

export type FitCategoryMeta = {
  label: FitCategory;
  shortLabel: string;
  description: string;
};

export type FitEvaluation = {
  category: FitCategory;
  score?: number;
  reasoning?: string;
};

export type ResumeItem = {
  id: string;
  role: string;
  company: string;
  timeline: string;
  highlights: string[];
  missingMetricsPrompt?: string;
};

export type ResumeData = {
  id: string;
  fileName: string;
  uploadedAt: string;
  summary: string;
  experience: ResumeItem[];
  skills: string[];
};

export type ProfileData = {
  fullName: string;
  location: string;
  workPermit: string;
  languages: string[];
  desiredIndustries: string[];
  desiredRoles: string[];
  activeResumeId: string;
};

export type JobStatus =
  | "Analyzed"
  | "Applied"
  | "For Interview";

export type JobStatusMap = Record<string, JobStatus>;

export type JobSource = "manual_upload" | "pasted_text" | "pasted_url";

export type JobPosting = {
  id: string;
  title: string;
  company: string;
  location: string;
  source: JobSource;
  salaryRange?: string;
  description: string;
  requiredSkills: string[];
};

export type JobAnalysis = {
  jobId: string;
  fit: FitCategory;
  score: number;
  strengths: string[];
  gaps: string[];
  hrView: string[];
  suggestedEdits: string[];
  suggestedQuestions: string[];
};

export type ResumeRewrite = {
  section: string;
  original: string;
  improved: string;
  note: string;
  changeSummary: string;
  requiresMetric: boolean;
};

export type OptimizeDocument = {
  name: string;
  location: string;
  phone: string;
  email: string;
  linkedin: string;
  workEligibility: string;
  languages: string[];
  summary: string;
  education: {
    school: string;
    degree: string;
    dates: string;
    highlights?: string[];
  }[];
  experience: {
    company: string;
    companyContext: string;
    role: string;
    timeline: string;
    bullets: string[];
  }[];
  tools: string[];
  other: { label: string; items: string[] }[];
};

export type OptimizeChangeNote = {
  whatChanged: string;
  whyItHelps: string;
  metricPrompt?: string;
};

export type MetricInput = {
  id: string;
  changeId: string;
  label: string;
  helpText: string;
  placeholder: string;
  bulletReplacePattern: string;
  rewordedBullet: string;
};

export type OptimizeJobData = {
  jobId: string;
  targetRole: { title: string; company: string };
  fit: FitCategory;
  score: number;
  optimizedDocument: OptimizeDocument;
  changes: Record<string, OptimizeChangeNote>;
  metricInputs: MetricInput[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type StarterPrompt = {
  id: string;
  label: string;
};

export type CoachChatContext = {
  primaryJobId: string | null;
  prioritizedJobIds: string[];
  fallbackMessage: string | null;
  shouldPrioritizeInterviewJobs: boolean;
  isInterviewFlow: boolean;
  interviewPracticeMode: "general" | "role-specific" | null;
  shouldAskInterviewModeChoice: boolean;
};
