import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Sidebar, type NavLink } from "@/components/Sidebar";

const links: NavLink[] = [
  { label: "Home", href: "/manager" },
  { label: "Deal details", href: "/manager/deal-details" },
  { label: "Calendar", href: "/manager/calendar" },
  { label: "Create customer", href: "/manager/create-customer" },
  { label: "AI review", href: "/manager/ai-review" },
];

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">

      <Suspense fallback={<div className="h-16 border-b" />}>
        <Header />
      </Suspense>

      <div className="flex flex-1">

        <Suspense
          fallback={
            <nav className="w-48 shrink-0 border-r p-4" />
          }
        >
          <Sidebar links={links} />
        </Suspense>

        <main className="min-w-0 flex-1 bg-slate-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          {children}
        </main>

      </div>
    </div>
  );
}