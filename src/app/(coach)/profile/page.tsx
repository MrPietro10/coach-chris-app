import { InfoCard } from "@/components/ui/info-card";
import { PageHeader } from "@/components/ui/page-header";
import { profile } from "@/mock-data/career-coach";

function Pill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-700">
      {text}
    </span>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your preferences — Chris uses these to judge how well a job fits you."
      />
      <InfoCard title="Identity">
        <p className="font-medium text-zinc-900">{profile.fullName}</p>
        <p>{profile.location}</p>
        <p className="mt-1.5 text-xs text-zinc-500">{profile.workPermit}</p>
      </InfoCard>
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard title="Languages">
          <div className="flex flex-wrap gap-1.5">
            {profile.languages.map((l) => <Pill key={l} text={l} />)}
          </div>
        </InfoCard>
        <InfoCard title="Industries">
          <div className="flex flex-wrap gap-1.5">
            {profile.desiredIndustries.map((i) => <Pill key={i} text={i} />)}
          </div>
        </InfoCard>
        <InfoCard title="Roles">
          <div className="flex flex-wrap gap-1.5">
            {profile.desiredRoles.map((r) => <Pill key={r} text={r} />)}
          </div>
        </InfoCard>
      </div>
    </>
  );
}
