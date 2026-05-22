"use client";

import { useIsClient } from "@/hooks/use-is-client";
import { MultiJobCompare } from "@/components/compare/multi-job-compare";

export default function ComparePage() {
  const isClient = useIsClient();
  if (!isClient) return null;
  return <MultiJobCompare />;
}
