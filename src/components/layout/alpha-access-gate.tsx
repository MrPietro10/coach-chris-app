"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { clearPersistedAlphaCode } from "@/lib/alpha-code-store";
import {
  clearActiveAlphaStorageNamespace,
  setActiveAlphaStorageNamespace,
} from "@/lib/alpha-session-store";

export function AlphaAccessGate({
  children,
  adminSessionActive = false,
}: {
  children: React.ReactNode;
  adminSessionActive?: boolean;
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const [alphaUnlocked, setAlphaUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enteredCode = useMemo(() => codeInput.trim(), [codeInput]);
  const isUnlocked = adminSessionActive || alphaUnlocked;

  useEffect(() => {
    clearPersistedAlphaCode();
    if (!adminSessionActive) {
      clearActiveAlphaStorageNamespace();
    }
  }, [adminSessionActive]);

  if (!isClient) {
    return null;
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  async function handleContinue() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/alpha-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: enteredCode,
          path: window.location.pathname,
        }),
      });

      if (!response.ok) {
        setError("Invalid access code.");
        return;
      }

      setActiveAlphaStorageNamespace(enteredCode);
      setAlphaUnlocked(true);
      router.push("/resume");
    } catch {
      setError("Unable to verify access code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <section className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900">Alpha Access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your alpha access code to continue.
        </p>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleContinue();
          }}
        >
          <input
            type="password"
            value={codeInput}
            onChange={(event) => {
              setCodeInput(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter access code"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Verifying..." : "Continue"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </section>
    </div>
  );
}
