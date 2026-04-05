"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { NotificationBell } from "@/components/notification-bell";
import type { Notification } from "@/components/notification-bell";

const links = [
  { href: "/designer", label: "Orders" },
  { href: "/designer/history", label: "History" },
] as const;

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const isLoginPage = pathname === "/designer/login";

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    let mounted = true;

    const onUnload = () => {
      fetch("/api/designer/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "offline" }),
        keepalive: true
      });
    };

    async function bootstrap() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          data?: { sub?: string; role?: string };
        };

        if (!mounted) return;

        if (!response.ok || !payload.success || payload.data?.role !== "designer") {
          router.replace("/designer/login");
          return;
        }

        setAuthorized(true);
        const id = payload.data.sub;
        setUserId(id);

        await fetch("/api/designer/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "online" })
        });

        window.addEventListener("beforeunload", onUnload);
      } catch {
        if (mounted) router.replace("/designer/login");
      } finally {
        if (mounted) setChecking(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [isLoginPage, router]);

  useRealtime({
    role: "designer",
    userId,
    onEvent: (event) => {
      if (event.type === "order.status.updated") {
        const p = event.payload;
        const changedByRole = (p.changedByRole as string) || "";
        if (changedByRole === "owner") {
          const orderNumber = (p.orderNumber as string) || "unknown";
          const newStatus = (p.newStatus as string) || "";
          setNotifications((prev) => [
            {
              id: crypto.randomUUID(),
              message: `Admin updated order ${orderNumber} to "${newStatus.replace(/_/g, " ")}"`,
              time: new Date(),
            },
            ...prev.slice(0, 49),
          ]);
        }
        window.dispatchEvent(new CustomEvent("designer:order-updated"));
      }
      if (event.type === "assignment.updated") {
        const orderNum = (event.payload?.orderNumber as string) || "new";
        setNotifications((prev) => [
          { id: crypto.randomUUID(), message: `New order assigned: ${orderNum}`, time: new Date() },
          ...prev.slice(0, 49),
        ]);
        window.dispatchEvent(new CustomEvent("designer:order-updated"));
      }
    }
  });

  async function handleLogout() {
    await fetch("/api/designer/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "offline" })
    });
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/designer/login");
  }

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafafa,#f1f1f1)] p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900">Designer Panel</h1>
            <div className="flex items-center gap-2">
              <NotificationBell notifications={notifications} />
              <nav className="flex gap-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
              </nav>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
