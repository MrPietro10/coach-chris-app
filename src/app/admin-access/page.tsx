"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { grantAdminAccessClient } from "@/lib/admin-access-store";

export default function AdminAccessPage() {
  const router = useRouter();
  const [passcodeInput, setPasscodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcodeInput }),
      });

      if (!response.ok) {
        setError("Invalid admin passcode.");
        return;
      }

      grantAdminAccessClient();
      router.push("/dashboard");
    } catch {
      setError("Unable to verify admin passcode. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <section className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900">Admin Access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter the admin passcode to unlock administrator mode.
        </p>
        <form className="mt-4" onSubmit={handleSubmit}>
          <input
            type="password"
            value={passcodeInput}
            onChange={(event) => {
              setPasscodeInput(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter admin passcode"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Verifying..." : "Enter admin mode"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </section>
    </div>
  );
}
