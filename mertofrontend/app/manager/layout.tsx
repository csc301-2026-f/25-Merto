import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Sidebar, type NavLink } from "@/components/Sidebar";

const links: NavLink[] = [
  { label: "Home", href: "/manager" },
  { label: "Deal details", href: "/manager/deal-details" },
  { label: "Create customer", href: "/manager/create-customer" },
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<div className="h-16 border-b-2" />}>
        <Header />
      </Suspense>
      <div className="flex flex-1">
        <Sidebar links={links} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}