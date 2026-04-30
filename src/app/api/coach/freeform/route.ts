import { NextResponse } from "next/server";
import {
  buildCoachReplyBehaviorContext,
  generateCoachReply,
  type GenerateCoachReplyInput,
  type ProviderConfigState,
} from "@/lib/ai";

type FreeformRequestBody = {
  userMessage: string;
  pageContext?: string;
  recentMessages?: GenerateCoachReplyInput["recentMessages"];
  selectedJobContext?: GenerateCoachReplyInput["selectedJobContext"];
  fitContext?: GenerateCoachReplyInput["fitContext"];
  optimizeContext?: GenerateCoachReplyInput["optimizeContext"];
  providerConfig?: ProviderConfigState;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<FreeformRequestBody>;
    const userMessage = body.userMessage?.trim();
    if (!userMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const input: GenerateCoachReplyInput = {
      userMessage,
      pageContext: body.pageContext,
      recentMessages: body.recentMessages,
      selectedJobContext: body.selectedJobContext,
      fitContext: body.fitContext,
      optimizeContext: body.optimizeContext,
      behaviorContext: buildCoachReplyBehaviorContext({
        userMessage,
        pageContext: body.pageContext,
        recentMessages: body.recentMessages,
        selectedJobContext: body.selectedJobContext,
        fitContext: body.fitContext,
        optimizeContext: body.optimizeContext,
      }),
    };

    const response = await generateCoachReply(input, {
      providerConfig: body.providerConfig,
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown freeform error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
