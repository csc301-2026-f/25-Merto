"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { label: string; href: string };

export function Sidebar({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 border-r-2 p-4">
      <ul className="space-y-5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={pathname === link.href ? "font-bold underline" : ""}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}