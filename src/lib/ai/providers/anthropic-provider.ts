import { ProviderNotImplementedError } from "@/lib/ai/errors";
import type {
  AIProvider,
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
} from "@/lib/ai/types";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";

  async analyzeJobFit(_input: AnalyzeJobFitInput): Promise<AnalyzeJobFitOutput> {
    throw new ProviderNotImplementedError(this.id);
  }

  async optimizeResume(_input: OptimizeResumeInput): Promise<OptimizeResumeOutput> {
    throw new ProviderNotImplementedError(this.id);
  }

  async generateCoachReply(_input: GenerateCoachReplyInput): Promise<GenerateCoachReplyOutput> {
    throw new ProviderNotImplementedError(this.id);
  }

  async analyzeSelectedJob(
    _input: AnalyzeSelectedJobInput,
  ): Promise<AnalyzeSelectedJobOutput> {
    throw new ProviderNotImplementedError(this.id);
  }

  async generateInterviewQuestion(
    _input: GenerateInterviewQuestionInput,
  ): Promise<GenerateInterviewQuestionOutput> {
    throw new ProviderNotImplementedError(this.id);
  }
}
