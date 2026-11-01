import Link from "next/link";
import type { ReactNode } from "react";

export function EntryLink({
  href,
  title,
  aside,
  children,
}: {
  href: string;
  title: ReactNode;
  aside: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg bg-current/5 p-4 transition-colors hover:bg-current/10"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="font-semibold">{title}</span>
        <span className="shrink-0 font-semibold">{aside}</span>
      </div>
      {children && <div className="mt-2 space-y-1 text-sm">{children}</div>}
    </Link>
  );
}