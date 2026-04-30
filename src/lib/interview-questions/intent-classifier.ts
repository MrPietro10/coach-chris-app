export type InterviewInputIntent =
  | "move_on"
  | "decision_should"
  | "decision_when"
  | "meta_what"
  | "meta_why"
  | "help"
  | "unsure"
  | "answer";

type IntentClassification = {
  intent: InterviewInputIntent;
  confidence: number;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function classifyInterviewInputIntent(text: string): IntentClassification {
  const normalized = text.trim().toLowerCase();
  const compact = normalized.replace(/[^\w\s']/g, " ");
  const tokens = compact.split(/\s+/).filter(Boolean);

  const hasWord = (word: string) => tokens.includes(word);
  const hasAny = (words: string[]) => words.some((word) => hasWord(word));
  const hasPhrase = (phrase: string) => compact.includes(phrase);
  const startsWithAny = (prefixes: string[]) =>
    prefixes.some((prefix) => compact.startsWith(prefix));
  const scores: Record<InterviewInputIntent, number> = {
    move_on: 0,
    decision_should: 0,
    decision_when: 0,
    meta_what: 0,
    meta_why: 0,
    help: 0,
    unsure: 0,
    answer: 0.2,
  };

  if (startsWithAny(["should i"]) || hasPhrase("should i")) {
    scores.decision_should += 0.95;
  }
  if (startsWithAny(["when should"]) || hasPhrase("when should")) {
    scores.decision_when += 0.95;
  }

  if (
    hasPhrase("next question") ||
    hasPhrase("move on") ||
    hasPhrase("lets move on") ||
    hasPhrase("let's move on")
  ) {
    scores.move_on += 0.9;
  }
  if (hasPhrase("i'm done") || hasPhrase("im done")) {
    scores.move_on += 0.8;
  }
  if (hasWord("next") && !hasAny(["how", "why", "what"])) {
    scores.move_on += 0.55;
  }
  if (hasAny(["done", "good"]) && hasAny(["this", "that", "we"])) {
    scores.move_on += 0.45;
  }

  if (startsWithAny(["what is", "what does"])) {
    scores.meta_what += 0.9;
  }
  if (hasPhrase("what is") || hasPhrase("what does")) {
    scores.meta_what += 0.65;
  }
  if (startsWithAny(["why"])) {
    scores.meta_why += 0.9;
  }
  if (hasPhrase("why does") || hasPhrase("why is")) {
    scores.meta_why += 0.75;
  }
  if (hasPhrase("what are they looking for") || hasPhrase("what is this question asking")) {
    scores.meta_why += 0.7;
  }
  if (hasWord("explain") && hasAny(["this", "question", "framework", "star"])) {
    scores.meta_why += 0.65;
  }

  if (hasWord("how") && hasWord("answer")) {
    scores.help += 0.75;
  }
  if (hasWord("help") && hasWord("answer")) {
    scores.help += 0.8;
  }
  if (
    hasPhrase("how do i answer") ||
    hasPhrase("how can i answer") ||
    hasPhrase("how to answer") ||
    hasPhrase("help me answer") ||
    hasPhrase("what is a good way to answer")
  ) {
    scores.help += 0.9;
  }
  if (hasWord("how") && hasAny(["answer", "respond", "say"])) {
    scores.help += 0.6;
  }
  if (hasWord("help") && hasAny(["answer", "respond", "say", "me"])) {
    scores.help += 0.55;
  }
  if (hasPhrase("good way") && hasAny(["answer", "respond"])) {
    scores.help += 0.45;
  }
  if (hasAny(["example", "sample"]) && hasAny(["answer", "response"])) {
    scores.help += 0.5;
  }

  if (hasWord("idk") || hasPhrase("i don't know") || hasPhrase("i dont know")) {
    scores.unsure += 0.9;
  }
  if (hasPhrase("not sure") || hasPhrase("no idea")) {
    scores.unsure += 0.8;
  }
  if (hasWord("maybe") && tokens.length <= 4) {
    scores.unsure += 0.5;
  }

  const ranked = (Object.entries(scores) as Array<[InterviewInputIntent, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const [bestIntent, rawBestScore] = ranked[0];

  if (rawBestScore < 0.7) {
    return { intent: "answer", confidence: 0.5 };
  }

  return {
    intent: bestIntent,
    confidence: clampConfidence(rawBestScore),
  };
}
