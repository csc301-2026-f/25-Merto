export function Card({
  title,
  count,
  hideCount,
  children,
}: {
  title: string;
  count?: number;
  hideCount?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border-2">
      <header className="flex items-center gap-3 border-b-2 p-3">
        {!hideCount && <span className="text-2xl font-bold">{count ?? "–"}</span>}
        <h2 className="font-semibold">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}