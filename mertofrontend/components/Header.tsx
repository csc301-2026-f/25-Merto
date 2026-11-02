import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";

export async function Header() {
  const session = await getSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-300 bg-slate-100 px-6 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Merto.ai logo" width={40} height={40} priority />
        <span className="text-xl font-bold">Merto.ai</span>
      </div>

      <div className="flex items-center gap-4">
        <span>Welcome {session?.name ?? "user"}</span>
        <form action={logout}>
          <button className="text-sm underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}