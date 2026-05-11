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

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI";

  async analyzeJobFit(input: AnalyzeJobFitInput): Promise<AnalyzeJobFitOutput> {
    void input;
    throw new ProviderNotImplementedError(this.id);
  }

  async optimizeResume(input: OptimizeResumeInput): Promise<OptimizeResumeOutput> {
    void input;
    throw new ProviderNotImplementedError(this.id);
  }

  async generateCoachReply(input: GenerateCoachReplyInput): Promise<GenerateCoachReplyOutput> {
    void input;
    throw new ProviderNotImplementedError(this.id);
  }

  async analyzeSelectedJob(
    input: AnalyzeSelectedJobInput,
  ): Promise<AnalyzeSelectedJobOutput> {
    void input;
    throw new ProviderNotImplementedError(this.id);
  }

  async generateInterviewQuestion(
    input: GenerateInterviewQuestionInput,
  ): Promise<GenerateInterviewQuestionOutput> {
    void input;
    throw new ProviderNotImplementedError(this.id);
  }
}
