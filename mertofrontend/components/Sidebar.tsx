"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

export type NavLink = {
  label: string;
  href: string;
};

const THEME_KEY = "merto-theme";

// localStorage is an external store, so React reads it with useSyncExternalStore
// instead of copying it into state from inside an effect.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // theme changed in another tab
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== "light"; // dark unless saved as light
  } catch {
    return true;
  }
}

// The server can't read localStorage, so it renders the default (dark).
const getServerSnapshot = () => true;

function saveTheme(isDark: boolean) {
  try {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {
    // Storage unavailable (e.g. private mode): the theme just won't persist.
  }
  listeners.forEach((listener) => listener());
}

export function Sidebar({
  links,
}: {
  links: NavLink[];
}) {
  const pathname = usePathname();

  const darkMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The most specific link that matches the current path is the active one,
  // so a root link like "/rep" or "/manager" isn't active on its sub-pages.
  const activeHref = links
    .filter(
      (link) =>
        pathname === link.href || pathname.startsWith(`${link.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Keep the <html> classes in sync with the theme. This only updates the DOM
  // (an external system) and never calls setState.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.classList.toggle("light", !darkMode);
  }, [darkMode]);

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
        onClick={() => saveTheme(!darkMode)}
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