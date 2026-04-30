export {
  getActiveProvider,
  getProviderConfig,
  isProviderConfigured,
  setActiveProvider,
  setProviderConfigured,
} from "@/lib/ai/provider-config";
export {
  getProviderConfigStore,
  setProviderConfigStore,
  type ProviderConfigStore,
} from "@/lib/ai/provider-config-store";
export { getProviderById, getRoutedProvider } from "@/lib/ai/provider-registry";
export {
  CHRIS_BEHAVIOR_POLICY,
  buildCoachReplyBehaviorContext,
  buildInterviewBehaviorContext,
  buildJobFitBehaviorContext,
  buildResumeOptimizationBehaviorContext,
} from "@/lib/ai/chris-behavior-policy";
export {
  analyzeJobFit,
  analyzeSelectedJob,
  generateCoachReply,
  generateInterviewQuestion,
  optimizeResume,
} from "@/lib/ai/service";
export { ProviderNotConfiguredError, ProviderNotImplementedError } from "@/lib/ai/errors";
export type {
  AIProvider,
  AIProviderId,
  AnalyzeJobFitInput,
  AnalyzeJobFitOutput,
  AnalyzeSelectedJobInput,
  AnalyzeSelectedJobOutput,
  ChrisBehaviorContext,
  ChrisBehaviorMode,
  ChrisBehaviorPolicy,
  GenerateCoachReplyInput,
  GenerateCoachReplyOutput,
  GenerateInterviewQuestionInput,
  GenerateInterviewQuestionOutput,
  OptimizeResumeInput,
  OptimizeResumeOutput,
  ProviderConfigState,
} from "@/lib/ai/types";
