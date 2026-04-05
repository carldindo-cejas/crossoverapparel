"use client";

import { useState } from "react";

export type Notification = {
  id: string;
  message: string;
  time: Date;
};

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
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
                  <p className="mt-1 text-xs text-neutral-400">{n.time.toLocaleTimeString("en-US", { timeZone: "Asia/Manila" })}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
