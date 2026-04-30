"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getStoredAlphaCode,
  isValidAlphaCode,
  setStoredAlphaCode,
} from "@/lib/alpha-code-store";

export function AlphaAccessGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enteredCode = useMemo(() => codeInput.trim(), [codeInput]);

  useEffect(() => {
    setMounted(true);
    const storedCode = getStoredAlphaCode() ?? "";
    if (isValidAlphaCode(storedCode)) {
      setIsUnlocked(true);
    }
  }, []);

  if (!mounted) {
    return null;
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <section className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900">Alpha Access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your alpha access code to continue.
        </p>
        <input
          type="password"
          value={codeInput}
          onChange={(event) => {
            setCodeInput(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter access code"
          className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
        />
        <button
          type="button"
          onClick={() => {
            if (!isValidAlphaCode(enteredCode)) {
              setError("Invalid access code.");
              return;
            }
            setStoredAlphaCode(enteredCode);
            setIsUnlocked(true);
          }}
          className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Continue
        </button>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </section>
    </div>
  );
}
