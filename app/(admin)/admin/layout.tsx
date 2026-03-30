"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await res.json()) as { success: boolean; data?: { role: string } };
        if (!mounted) return;

        if (res.ok && payload.success && payload.data?.role === "owner") {
          setAuthorized(true);
        } else {
          router.replace("/admin/login");
        }
      } catch {
        if (mounted) router.replace("/admin/login");
      } finally {
        if (mounted) setChecking(false);
      }
    }

    check();
    return () => { mounted = false; };
  }, [isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f8f8_0%,#f0f0f0_100%)] p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[18rem_1fr]">
        <AdminSidebar />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
