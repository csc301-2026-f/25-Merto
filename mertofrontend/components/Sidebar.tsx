"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavLink = {
  label: string;
  href: string;
};

export function Sidebar({
  links,
}: {
  links: NavLink[];
}) {
  const pathname = usePathname();

  const [darkMode, setDarkMode] = useState(true);

  // The most specific link that matches the current path is the active one,
  // so a root link like "/rep" or "/manager" isn't active on its sub-pages.
  const activeHref = links
    .filter(
      (link) =>
        pathname === link.href || pathname.startsWith(`${link.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Restore the user's theme preference.
  useEffect(() => {
    const savedTheme = localStorage.getItem("merto-theme");

    const isDark = savedTheme !== "light";

    setDarkMode(isDark);

    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  function toggleTheme() {
    const newDarkMode = !darkMode;

    setDarkMode(newDarkMode);

    document.documentElement.classList.toggle(
      "dark",
      newDarkMode
    );

    document.documentElement.classList.toggle(
      "light",
      !newDarkMode
    );

    localStorage.setItem(
      "merto-theme",
      newDarkMode ? "dark" : "light"
    );
  }

  return (
    <nav className="w-48 shrink-0 border-r border-slate-300 bg-slate-100 p-4 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white flex flex-col">

      <ul className="space-y-4">
        {links.map((link) => {
          const active = link.href === activeHref;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-md px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 ${
                  active
                    ? "font-bold underline underline-offset-4"
                    : ""
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Theme switch at the bottom */}
      <button
        type="button"
        onClick={toggleTheme}
        className="mt-8 flex w-full items-center justify-between rounded-lg border border-zinc-400 px-3 py-2 text-sm font-semibold hover:bg-black/10 dark:border-zinc-600 dark:hover:bg-white/10"
      >
        <span>
          {darkMode ? "Light mode" : "Dark mode"}
        </span>

        <span>
          {darkMode ? "☀" : "☾"}
        </span>
      </button>

    </nav>
  );
}