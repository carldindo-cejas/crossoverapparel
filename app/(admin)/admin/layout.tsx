"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useRealtime } from "@/hooks/use-realtime";
import type { Notification } from "@/components/notification-bell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  useRealtime({
    role: "owner",
    onEvent: (event) => {
      if (event.type === "order.status.updated") {
        const p = event.payload;
        const changedByRole = (p.changedByRole as string) || "";
        if (changedByRole === "designer") {
          const orderNumber = (p.orderNumber as string) || "unknown";
          const newStatus = (p.newStatus as string) || "";
          const designerName = (p.changedByName as string) || "Designer";
          setNotifications((prev) => [
            {
              id: crypto.randomUUID(),
              message: `${designerName} updated order ${orderNumber} to "${newStatus.replace(/_/g, " ")}"`,
              time: new Date(),
            },
            ...prev.slice(0, 49),
          ]);
        }
        window.dispatchEvent(new CustomEvent("admin:order-updated"));
      }
      if (event.type === "order.created") {
        const orderNumber = (event.payload.orderNumber as string) || "new";
        setNotifications((prev) => [
          {
            id: crypto.randomUUID(),
            message: `New order placed: ${orderNumber}`,
            time: new Date(),
          },
          ...prev.slice(0, 49),
        ]);
        window.dispatchEvent(new CustomEvent("admin:order-updated"));
      }
    },
  });

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
        <AdminSidebar notifications={notifications} />
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
