import Link from "next/link";

export function AccessDenied() {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-950">Access denied</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600">
        This area is restricted to administrators. If you believe you should have access, check
        that you are signed in with the correct account.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Back to dashboard
      </Link>
    </section>
  );
}
