"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ALPHA_SESSION_CHANGED_EVENT } from "@/lib/alpha-session-store";
import { workspaceHasReadyFitAnalysis } from "@/lib/analysis-records";
import {
  COACH_CHRIS_AUDIENCE,
  COACH_CHRIS_OUTCOME,
  COACH_CHRIS_TAGLINE,
  ONBOARDING_STEP_ROUTES,
  ONBOARDING_STEPS,
} from "@/lib/coach-chris-onboarding";
import { JOB_WORKSPACE_CHANGED_EVENT } from "@/lib/job-session-store";

type ActiveStep = 1 | 2 | 3;

const STEP_FOCUS_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

function useCanNavigateToResults(): boolean {
  const [canNavigate, setCanNavigate] = useState(false);

  useEffect(() => {
    const refresh = () => setCanNavigate(workspaceHasReadyFitAnalysis());
    refresh();
    window.addEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
    window.addEventListener("career-coach:analysis-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(JOB_WORKSPACE_CHANGED_EVENT, refresh);
      window.removeEventListener("career-coach:analysis-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALPHA_SESSION_CHANGED_EVENT, refresh);
    };
  }, []);

  return canNavigate;
}

function StepBadge({ step, isActive }: { step: number; isActive: boolean }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
      }`}
      aria-hidden
    >
      {step}
    </span>
  );
}

function stepShellClass(isActive: boolean): string {
  return `flex w-full gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
    isActive ? "border-zinc-300 bg-zinc-50" : "border-transparent bg-transparent"
  }`;
}

function StepList({
  activeStep,
  compact = false,
  canNavigateToResults,
}: {
  activeStep?: ActiveStep;
  compact?: boolean;
  canNavigateToResults: boolean;
}) {
  return (
    <ol className={compact ? "space-y-2" : "space-y-3"}>
      {ONBOARDING_STEPS.map((item) => {
        const isActive = activeStep === item.step;
        const shellClass = stepShellClass(isActive);

        if (item.step === 1 || item.step === 2) {
          const href = ONBOARDING_STEP_ROUTES[item.step];
          return (
            <li key={item.step}>
              <Link
                href={href}
                aria-current={isActive ? "step" : undefined}
                className={`${shellClass} hover:bg-zinc-50/80 ${STEP_FOCUS_CLASS}`}
              >
                <StepBadge step={item.step} isActive={isActive} />
                <div className="min-w-0">
                  <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-zinc-900`}>
                    {item.title}
                  </p>
                  {!compact ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{item.description}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        }

        if (!canNavigateToResults) {
          return (
            <li key={item.step}>
              <div className={`${shellClass} cursor-not-allowed opacity-70`} aria-disabled="true">
                <StepBadge step={item.step} isActive={isActive} />
                <div className="min-w-0">
                  <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-zinc-900`}>
                    {item.title}
                  </p>
                  {!compact ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{item.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">Run an analysis first.</p>
                </div>
              </div>
            </li>
          );
        }

        return (
          <li key={item.step}>
            <Link
              href={ONBOARDING_STEP_ROUTES[3]}
              aria-current={isActive ? "step" : undefined}
              className={`${shellClass} hover:bg-zinc-50/80 ${STEP_FOCUS_CLASS}`}
            >
              <StepBadge step={item.step} isActive={isActive} />
              <div className="min-w-0">
                <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-zinc-900`}>
                  {item.title}
                </p>
                {!compact ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{item.description}</p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function CoachChrisIntro({
  variant = "full",
  activeStep,
  showOutcome = false,
}: {
  variant?: "full" | "compact" | "sidebar";
  activeStep?: ActiveStep;
  showOutcome?: boolean;
}) {
  const canNavigateToResults = useCanNavigateToResults();

  if (variant === "sidebar") {
    return (
      <div className="mb-4 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          How it works
        </p>
        <ol className="mt-2 space-y-1.5">
          {ONBOARDING_STEPS.map((item) => {
            const isActive = activeStep === item.step;
            const textClass = isActive ? "font-medium text-zinc-900" : "text-zinc-600";

            if (item.step === 3 && !canNavigateToResults) {
              return (
                <li key={item.step} className="text-[11px] leading-snug text-zinc-400">
                  <div aria-disabled="true">
                    <span className="font-semibold text-zinc-500">{item.step}.</span> {item.title}
                    <span className="mt-0.5 block text-[10px] text-zinc-500">Run an analysis first.</span>
                  </div>
                </li>
              );
            }

            const href = ONBOARDING_STEP_ROUTES[item.step];
            return (
              <li key={item.step}>
                <Link
                  href={href}
                  aria-current={isActive ? "step" : undefined}
                  className={`block rounded-md text-[11px] leading-snug transition-colors hover:text-zinc-900 ${textClass} ${STEP_FOCUS_CLASS}`}
                >
                  <span className="font-semibold text-zinc-700">{item.step}.</span> {item.title}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3">
        <p className="text-sm text-zinc-700">{COACH_CHRIS_TAGLINE}</p>
        <div className="mt-3">
          <StepList activeStep={activeStep} compact canNavigateToResults={canNavigateToResults} />
        </div>
        {showOutcome ? <p className="mt-3 text-xs text-zinc-600">{COACH_CHRIS_OUTCOME}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <p className="text-sm font-medium text-zinc-900">{COACH_CHRIS_TAGLINE}</p>
      <p className="mt-2 text-sm text-zinc-600">{COACH_CHRIS_AUDIENCE}</p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How it works</p>
        <div className="mt-2">
          <StepList activeStep={activeStep} canNavigateToResults={canNavigateToResults} />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        <span className="font-medium text-zinc-800">What you get: </span>
        {COACH_CHRIS_OUTCOME}
      </p>
    </section>
  );
}
