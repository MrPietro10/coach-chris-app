export type AIProviderId = "gemini" | "openai" | "anthropic";

export type ProviderConfigState = {
  activeProvider: AIProviderId;
  configuredProviders: Record<AIProviderId, boolean>;
};

export type ChrisBehaviorMode =
  | "freeform-coaching-chat"
  | "job-fit-analysis"
  | "interview-feedback"
  | "resume-optimization";

export type ChrisBehaviorPolicy = {
  identity: string[];
  coreRules: string[];
  productPriorities: string[];
  tone: string[];
  modeGuidelines: Record<ChrisBehaviorMode, string[]>;
};

export type ChrisBehaviorContext = {
  mode: ChrisBehaviorMode;
  policy: ChrisBehaviorPolicy;
  guidance: string[];
};

export type AnalyzeJobFitInput = {
  jobTitle: string;
  company: string;
  resumeSummary: string;
  requiredSkills: string[];
  behaviorContext?: ChrisBehaviorContext;
};

export type AnalyzeJobFitOutput = {
  provider: AIProviderId;
  score: number;
  fitLabel: "No Fit" | "Aspirational Fit" | "Backup Fit" | "Strong Fit";
  strengths: string[];
  gaps: string[];
  reasoning: string;
};

export type AnalyzeSelectedJobInput = {
  selectedJob: {
    jobId: string;
    title: string;
    company: string;
    location?: string;
    description: string;
    requiredSkills: string[];
    status?: string;
  };
  resumeContext: {
    summary: string;
    skills: string[];
    experienceHighlights: string[];
  };
  fitContext?: {
    fit: string;
    score: number;
    topStrengths: string[];
    topGaps: string[];
  };
  optimizeContext?: {
    targetRole: string;
    targetCompany: string;
    keyChanges: string[];
    metricPrompts: string[];
  };
  behaviorContext?: ChrisBehaviorContext;
};

export type AnalyzeSelectedJobOutput = {
  provider: AIProviderId;
  fitScore: number;
  rubricScores: {
    experience: number;
    evidence: number;
    skills: number;
    domain: number;
    role: number;
  };
  rubricExplanations: {
    experience: string;
    evidence: string;
    skills: string;
    domain: string;
    role: string;
  };
  overallFitSummary: string;
  topStrengths: string[];
  topGaps: string[];
  riskAreas: string[];
  highestPriorityImprovement: string;
  missingEvidence: string[];
};

export type OptimizeResumeInput = {
  targetRole: string;
  currentSummary: string;
  bullets: string[];
  behaviorContext?: ChrisBehaviorContext;
};

export type OptimizeResumeOutput = {
  provider: AIProviderId;
  optimizedSummary: string;
  optimizedBullets: string[];
  notes: string[];
};

export type GenerateCoachReplyInput = {
  userMessage: string;
  pageContext?: string;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  selectedJobContext?: {
    jobId: string;
    title: string;
    company: string;
    status?: string;
  };
  fitContext?: {
    fit: string;
    score: number;
    topGaps: string[];
    topStrengths: string[];
  };
  optimizeContext?: {
    targetRole: string;
    targetCompany: string;
    keyChanges: string[];
    metricPrompts: string[];
  };
  behaviorContext?: ChrisBehaviorContext;
};

export type GenerateCoachReplyOutput = {
  provider: AIProviderId;
  reply: string;
  followUps: string[];
};

export type GenerateInterviewQuestionInput = {
  mode: "general" | "role-specific";
  roleTitle?: string;
  company?: string;
  priorQuestionCount?: number;
  behaviorContext?: ChrisBehaviorContext;
};

export type GenerateInterviewQuestionOutput = {
  provider: AIProviderId;
  question: string;
  coachingHint: string;
};

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;

  analyzeJobFit(input: AnalyzeJobFitInput): Promise<AnalyzeJobFitOutput>;
  optimizeResume(input: OptimizeResumeInput): Promise<OptimizeResumeOutput>;
  generateCoachReply(input: GenerateCoachReplyInput): Promise<GenerateCoachReplyOutput>;
  analyzeSelectedJob(input: AnalyzeSelectedJobInput): Promise<AnalyzeSelectedJobOutput>;
  generateInterviewQuestion(
    input: GenerateInterviewQuestionInput,
  ): Promise<GenerateInterviewQuestionOutput>;
}
