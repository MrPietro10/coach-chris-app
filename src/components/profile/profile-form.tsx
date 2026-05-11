"use client";

import { useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { PageHeader } from "@/components/ui/page-header";
import { getStoredProfile, saveStoredProfile } from "@/lib/job-session-store";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readStoredProfileFields() {
  const stored = getStoredProfile();
  return {
    fullName: stored.fullName,
    location: stored.location,
    workPermit: stored.workPermit,
    languagesInput: stored.languages.join(", "),
    industriesInput: stored.desiredIndustries.join(", "),
    rolesInput: stored.desiredRoles.join(", "),
  };
}

export function ProfileForm() {
  const isClient = useIsClient();
  const [fullName, setFullName] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().fullName,
  );
  const [location, setLocation] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().location,
  );
  const [workPermit, setWorkPermit] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().workPermit,
  );
  const [languagesInput, setLanguagesInput] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().languagesInput,
  );
  const [industriesInput, setIndustriesInput] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().industriesInput,
  );
  const [rolesInput, setRolesInput] = useState(() =>
    typeof window === "undefined" ? "" : readStoredProfileFields().rolesInput,
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your preferences help Chris judge how well a job fits you."
      />
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <p className="text-sm text-zinc-600">
          Add the basics Chris can use for fit and coaching context.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={workPermit}
            onChange={(event) => setWorkPermit(event.target.value)}
            placeholder="Work authorization"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:col-span-2"
          />
          <input
            type="text"
            value={languagesInput}
            onChange={(event) => setLanguagesInput(event.target.value)}
            placeholder="Languages (comma-separated)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={industriesInput}
            onChange={(event) => setIndustriesInput(event.target.value)}
            placeholder="Target industries (comma-separated)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          />
          <input
            type="text"
            value={rolesInput}
            onChange={(event) => setRolesInput(event.target.value)}
            placeholder="Target roles (comma-separated)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 sm:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            saveStoredProfile({
              fullName,
              location,
              workPermit,
              languages: splitList(languagesInput),
              desiredIndustries: splitList(industriesInput),
              desiredRoles: splitList(rolesInput),
              activeResumeId: "",
            });
            setNotice("Profile saved.");
          }}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Save profile
        </button>
        {notice && (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {notice}
          </p>
        )}
      </section>
    </>
  );
}
