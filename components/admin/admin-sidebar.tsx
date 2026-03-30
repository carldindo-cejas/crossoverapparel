"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/staff", label: "Designers" },
  { href: "/admin/reports", label: "Reports" }
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="w-full rounded-3xl border border-neutral-200 bg-white p-5 lg:w-72">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-neutral-500">Crossover Owner</p>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm font-medium",
                active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </nav>
    </aside>
  );
}
