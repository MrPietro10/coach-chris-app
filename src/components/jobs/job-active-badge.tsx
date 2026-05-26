type JobActiveBadgeProps = {
  variant: "active" | "analyzing";
};

export function JobActiveBadge({ variant }: JobActiveBadgeProps) {
  if (variant === "analyzing") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
        Analyzing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
      Active
    </span>
  );
}
