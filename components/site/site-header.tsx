"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { type Product } from "@/lib/types";

const links = [
  { href: "/", label: "Home" },
  { href: "/custom-order", label: "Custom Order" },
  { href: "/track-order", label: "Track Order" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const loginActive =
    pathname === "/login" ||
    pathname === "/owner/login" ||
    pathname === "/designer/login";

  const { data: products } = useApi<Product[]>("/api/products");

  const activeProducts = useMemo(
    () => (products || []).filter((p) => p.status === "active"),
    [products]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return activeProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, activeProducts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      // If there's exactly one result, go to it
      if (searchResults.length === 1) {
        router.push(`/product-order/${searchResults[0].id}` as any);
        setQuery("");
        setShowResults(false);
      } else if (searchResults.length > 0) {
        // Go to first result
        router.push(`/product-order/${searchResults[0].id}` as any);
        setQuery("");
        setShowResults(false);
      } else {
        // Fallback: try as order number for tracking
        router.push(`/track-order?id=${encodeURIComponent(q)}`);
        setQuery("");
        setShowResults(false);
      }
    }
  }

  function pickProduct(productId: number) {
    router.push(`/product-order/${productId}` as any);
    setQuery("");
    setShowResults(false);
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

          {/* Search Products by SKU or Name */}
          <div ref={wrapperRef} className="relative w-full sm:w-56 lg:w-72">
            <form
              onSubmit={handleSearch}
              className="flex w-full items-center overflow-hidden rounded-full border border-neutral-200 bg-white"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="Search SKU or product name…"
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

            {/* Search results dropdown */}
            {showResults && query.trim().length >= 1 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                {searchResults.length > 0 ? (
                  searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50"
                    >
                      {p.image_url ? (
                        <img src={`/api/products/images/${p.image_url}`} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-300">📷</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{p.name}</p>
                        <p className="text-xs text-neutral-500">{p.sku}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-neutral-500">No products found</p>
                )}
              </div>
            )}
          </div>

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
