import {
  COACH_CHRIS_AUDIENCE,
  COACH_CHRIS_OUTCOME,
  COACH_CHRIS_TAGLINE,
  ONBOARDING_STEPS,
} from "@/lib/coach-chris-onboarding";

type ActiveStep = 1 | 2 | 3;

function StepList({
  activeStep,
  compact = false,
}: {
  activeStep?: ActiveStep;
  compact?: boolean;
}) {
  return (
    <ol className={compact ? "space-y-2" : "space-y-3"}>
      {ONBOARDING_STEPS.map((item) => {
        const isActive = activeStep === item.step;
        return (
          <li
            key={item.step}
            className={`flex gap-3 rounded-lg border px-3 py-2.5 ${
              isActive
                ? "border-zinc-300 bg-zinc-50"
                : "border-transparent bg-transparent"
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
              }`}
              aria-hidden
            >
              {item.step}
            </span>
            <div className="min-w-0">
              <p
                className={`${
                  compact ? "text-xs" : "text-sm"
                } font-medium text-zinc-900`}
              >
                {item.title}
              </p>
              {!compact && (
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
                  {item.description}
                </p>
              )}
            </div>
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
  if (variant === "sidebar") {
    return (
      <div className="mb-4 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          How it works
        </p>
        <ol className="mt-2 space-y-1.5">
          {ONBOARDING_STEPS.map((item) => (
            <li
              key={item.step}
              className={`text-[11px] leading-snug ${
                activeStep === item.step
                  ? "font-medium text-zinc-900"
                  : "text-zinc-600"
              }`}
            >
              <span className="font-semibold text-zinc-700">{item.step}.</span>{" "}
              {item.title}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3">
        <p className="text-sm text-zinc-700">{COACH_CHRIS_TAGLINE}</p>
        <div className="mt-3">
          <StepList activeStep={activeStep} compact />
        </div>
        {showOutcome && (
          <p className="mt-3 text-xs text-zinc-600">{COACH_CHRIS_OUTCOME}</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <p className="text-sm font-medium text-zinc-900">{COACH_CHRIS_TAGLINE}</p>
      <p className="mt-2 text-sm text-zinc-600">{COACH_CHRIS_AUDIENCE}</p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          How it works
        </p>
        <div className="mt-2">
          <StepList activeStep={activeStep} />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        <span className="font-medium text-zinc-800">What you get: </span>
        {COACH_CHRIS_OUTCOME}
      </p>
    </section>
  );
}
