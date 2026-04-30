import { PageHeader } from "@/components/ui/page-header";
import { AskChrisLink } from "@/components/ui/ask-chris-link";

export default function ChatPage() {
  return (
    <>
      <PageHeader
        title="Chat (Testing Route)"
        subtitle="Primary chat experience is the floating Ask Chris panel."
      />
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
        <p className="text-sm text-zinc-600">
          This route is kept for testing only. Use the floating assistant for
          the production chat experience.
        </p>
        <div className="mt-3">
          <AskChrisLink prompt="Help me prep for interviews this week">
            Open Ask Chris with interview prompt
          </AskChrisLink>
        </div>
      </section>
    </>
  );
}
