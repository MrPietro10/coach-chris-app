export function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5">
      <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-zinc-600">{children}</div>
    </section>
  );
}
