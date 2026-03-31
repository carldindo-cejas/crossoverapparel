"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";

const links = [
  { href: "/designer", label: "Orders" },
  { href: "/designer/history", label: "History" },
] as const;

type Notification = { id: string; message: string; time: Date };

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
              <DesignerNotificationBell notifications={notifications} />
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

function DesignerNotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const unread = notifications.length - readCount;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) setReadCount(notifications.length);
        }}
        className="relative rounded-full border border-neutral-200 bg-white p-2 text-neutral-700 hover:bg-neutral-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
          </div>
          <div className="max-h-64 overflow-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  <p className="text-sm text-neutral-800">{n.message}</p>
                  <p className="mt-1 text-xs text-neutral-400">{n.time.toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
