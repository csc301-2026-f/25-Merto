export function Card({
  title,
  count,
  hideCount,
  aside,
  children,
}: {
  title: string;
  count?: number;
  hideCount?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-1 pb-3">
        <div className="flex items-baseline gap-3">
          {!hideCount && <span className="text-3xl font-bold text-[#b08b46] dark:text-[#d5bd91]">{count ?? "–"}</span>}
          <h2 className="font-semibold">{title}</h2>
        </div>
        {aside && <div className="text-sm">{aside}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}