"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import {
  getStoredAlphaCode,
  isValidAlphaCode,
  setStoredAlphaCode,
} from "@/lib/alpha-code-store";
import { isAdminAccessStored } from "@/lib/admin-access-store";

export function AlphaAccessGate({
  children,
  adminSessionActive = false,
}: {
  children: React.ReactNode;
  adminSessionActive?: boolean;
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const [alphaUnlocked, setAlphaUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    if (isAdminAccessStored()) return true;
    const storedCode = getStoredAlphaCode() ?? "";
    return isValidAlphaCode(storedCode);
  });
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enteredCode = useMemo(() => codeInput.trim(), [codeInput]);
  const isUnlocked = adminSessionActive || alphaUnlocked;

  if (!isClient) {
    return null;
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  function handleContinue() {
    if (!isValidAlphaCode(enteredCode)) {
      setError("Invalid access code.");
      return;
    }
    setStoredAlphaCode(enteredCode);
    setAlphaUnlocked(true);
    router.push("/resume");
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
            handleContinue();
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
            className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Continue
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </section>
    </div>
  );
}
