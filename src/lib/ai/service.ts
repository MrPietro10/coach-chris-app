import { getRoutedProvider } from "@/lib/ai/provider-registry";
import {
  buildCoachReplyBehaviorContext,
  buildInterviewBehaviorContext,
  buildJobFitBehaviorContext,
  buildResumeOptimizationBehaviorContext,
} from "@/lib/ai/chris-behavior-policy";
import type {
  AnalyzeJobFitInput,
  AnalyzeJobFitOutput,
  AnalyzeSelectedJobInput,
  AnalyzeSelectedJobOutput,
  GenerateCoachReplyInput,
  GenerateCoachReplyOutput,
  GenerateInterviewQuestionInput,
  GenerateInterviewQuestionOutput,
  OptimizeResumeInput,
  OptimizeResumeOutput,
  ProviderConfigState,
} from "@/lib/ai/types";

type ServiceRoutingOptions = {
  providerConfig?: ProviderConfigState;
};

export async function analyzeJobFit(
  input: AnalyzeJobFitInput,
  options?: ServiceRoutingOptions,
): Promise<AnalyzeJobFitOutput> {
  const provider = getRoutedProvider(options?.providerConfig);
  return provider.analyzeJobFit({
    ...input,
    behaviorContext: input.behaviorContext ?? buildJobFitBehaviorContext(input),
  });
}

export async function optimizeResume(
  input: OptimizeResumeInput,
  options?: ServiceRoutingOptions,
): Promise<OptimizeResumeOutput> {
  const provider = getRoutedProvider(options?.providerConfig);
  return provider.optimizeResume({
    ...input,
    behaviorContext: input.behaviorContext ?? buildResumeOptimizationBehaviorContext(input),
  });
}

export async function generateCoachReply(
  input: GenerateCoachReplyInput,
  options?: ServiceRoutingOptions,
): Promise<GenerateCoachReplyOutput> {
  const provider = getRoutedProvider(options?.providerConfig);
  return provider.generateCoachReply({
    ...input,
    behaviorContext: input.behaviorContext ?? buildCoachReplyBehaviorContext(input),
  });
}

export async function analyzeSelectedJob(
  input: AnalyzeSelectedJobInput,
  options?: ServiceRoutingOptions,
): Promise<AnalyzeSelectedJobOutput> {
  const provider = getRoutedProvider(options?.providerConfig);
  return provider.analyzeSelectedJob({
    ...input,
    behaviorContext:
      input.behaviorContext ??
      buildJobFitBehaviorContext({
        jobTitle: input.selectedJob.title,
        company: input.selectedJob.company,
        resumeSummary: input.resumeContext.summary,
        requiredSkills: input.selectedJob.requiredSkills,
      }),
  });
}

export async function generateInterviewQuestion(
  input: GenerateInterviewQuestionInput,
  options?: ServiceRoutingOptions,
): Promise<GenerateInterviewQuestionOutput> {
  const provider = getRoutedProvider(options?.providerConfig);
  return provider.generateInterviewQuestion({
    ...input,
    behaviorContext: input.behaviorContext ?? buildInterviewBehaviorContext(input),
  });
}
