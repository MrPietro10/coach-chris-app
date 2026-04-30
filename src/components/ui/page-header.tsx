export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
    </header>
  );
}
