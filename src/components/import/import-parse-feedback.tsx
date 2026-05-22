"use client";

import { useState } from "react";

type ImportParseFeedbackProps = {
  question: string;
  onSubmit: (rating: "up" | "down", comment?: string) => void;
  disabled?: boolean;
};

export function ImportParseFeedback({
  question,
  onSubmit,
  disabled = false,
}: ImportParseFeedbackProps) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  function handleRating(next: "up" | "down"): void {
    if (disabled) return;
    setRating(next);
    setShowComment(true);
    onSubmit(next, comment.trim() || undefined);
  }

  function handleCommentBlur(): void {
    if (!rating || disabled) return;
    onSubmit(rating, comment.trim() || undefined);
  }

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3">
      <p className="text-xs font-medium text-zinc-800">{question}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Your feedback is saved locally to improve imports — it does not train a model yet.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleRating("up")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            rating === "up"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
          aria-label="Import was correct"
        >
          <span aria-hidden>👍</span>
          Yes
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleRating("down")}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            rating === "down"
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
          aria-label="Import was incorrect"
        >
          <span aria-hidden>👎</span>
          No
        </button>
      </div>
      {showComment ? (
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onBlur={handleCommentBlur}
          disabled={disabled}
          placeholder="Optional: what was wrong or missing?"
          className="mt-2 min-h-16 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700"
        />
      ) : null}
    </div>
  );
}
