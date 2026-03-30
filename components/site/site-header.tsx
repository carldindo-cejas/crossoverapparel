"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/custom-order", label: "Custom Order" },
  { href: "/track-order", label: "Track Order" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const loginActive =
    pathname === "/login" ||
    pathname === "/owner/login" ||
    pathname === "/designer/login";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = query.trim();
    if (id) {
      router.push(`/track-order?id=${encodeURIComponent(id)}`);
      setQuery("");
    }
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b border-neutral-200/70 bg-white/85 backdrop-blur"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 py-2 sm:h-16 sm:flex-nowrap sm:py-0">

          {/* Logo + Login */}
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start sm:gap-3">
            <Link
              href="/"
              className="truncate text-base font-semibold tracking-wide text-neutral-900 sm:text-xl"
            >
              CROSSOVER APPAREL
            </Link>
            <Link
              href="/login"
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors sm:hidden",
                loginActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              )}
            >
              Login
            </Link>
          </div>

          {/* Search Product ID */}
          <form
            onSubmit={handleSearch}
            className="flex w-full items-center overflow-hidden rounded-full border border-neutral-200 bg-white sm:w-56 lg:w-72"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Product ID…"
              className="min-w-0 flex-1 bg-transparent px-4 py-1.5 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex items-center justify-center px-3 py-1.5 text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
            </button>
          </form>

          {/* Nav links */}
          <nav className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-neutral-200 bg-white p-1 sm:ml-auto sm:w-auto">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:text-neutral-900"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Login — desktop only */}
            <Link
              href="/login"
              className={cn(
                "hidden whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors sm:inline-block",
                loginActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              )}
            >
              Login
            </Link>
          </nav>

        </div>
      </div>
    </motion.header>
  );
}
