"use client";

import { askChris } from "@/utils/ask-chris";

export function AskChrisLink({
  prompt,
  children,
  className,
}: {
  prompt: string;
  children: React.ReactNode;
  className?: string;
}) {
  const baseClassName =
    "inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600";
  return (
    <button
      type="button"
      onClick={() => askChris(prompt)}
      className={className ?? baseClassName}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>{children}</span>
    </button>
  );
}
