"use client";

import { useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { AnimatedPage } from "@/components/site/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type Product, type Category } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format";

const CATEGORY_ORDER = ["Jerseys", "Tshirts", "Poloshirts", "Warmers"];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-neutral-200 text-neutral-200"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

function ProductCarousel({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (products.length === 0) {
    return <p className="py-6 text-sm text-neutral-500">No products yet.</p>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50"
      >
        ‹
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {products.map((product) => (
          <motion.div
            key={product.id}
            whileHover={{ y: -4 }}
            className="w-56 flex-shrink-0"
          >
            <Link href={`/custom-order?productId=${product.id}`}>
            <Card className="overflow-hidden border-neutral-200">
              <div className="relative aspect-[4/5] bg-neutral-100">
                {product.image_url ? (
                  <img
                    src={`/api/products/images/${product.image_url}`}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
                    <span className="text-4xl text-neutral-300">📷</span>
                  </div>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <h3 className="truncate text-sm font-semibold text-neutral-900">
                  {product.name}
                </h3>
                <StarRating rating={product.rating ?? 0} />
                <p className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(product.base_price_cents, product.currency)}
                </p>
              </CardContent>
            </Card>
            </Link>
          </motion.div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50"
      >
        ›
      </button>
    </div>
  );
}

export default function HomePage() {
  const { data: products } = useApi<Product[]>("/api/products");
  const { data: categories } = useApi<Category[]>("/api/categories");

  const activeProducts = useMemo(
    () => (products || []).filter((p) => p.status === "active"),
    [products]
  );

  const featured = activeProducts.slice(0, 6);

  const categoryProducts = useMemo(() => {
    const catMap = new Map<string, Product[]>();
    for (const name of CATEGORY_ORDER) {
      const cat = (categories || []).find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (cat) {
        catMap.set(
          name,
          activeProducts.filter((p) => p.category_id === cat.id)
        );
      } else {
        catMap.set(name, []);
      }
    }
    return catMap;
  }, [activeProducts, categories]);

  return (
    <AnimatedPage>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-16 pt-16 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
            Crossover Apparel
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-neutral-900 md:text-6xl">
            Premium teamwear engineered for identity.
          </h1>
          <p className="max-w-xl text-neutral-600">
            Minimal silhouettes, custom detailing, and production-grade ordering
            for clubs, schools, and performance teams.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/custom-order">
              <Button size="lg">Start Custom Order</Button>
            </Link>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-neutral-200"
        >
          <Image
            src="/images/banner/banner.jpg.png"
            alt="Crossover Apparel Banner"
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      </section>

      {/* Featured Collection */}
      <section className="mx-auto w-full max-w-7xl px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Featured
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">
            Featured Collection
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-neutral-600">
            Newly uploaded products from our latest drops.
          </p>
        </motion.div>
        <ProductCarousel products={featured} />
      </section>

      {/* Explore Collection */}
      <section className="mx-auto w-full max-w-7xl px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Browse
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">
            Explore Collection
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-neutral-600">
            Browse by category and find the perfect fit for your team.
          </p>
        </motion.div>

        {CATEGORY_ORDER.map((catName) => (
          <div key={catName} className="mb-10">
            <h3 className="mb-4 text-center text-xl font-semibold text-neutral-800">
              {catName}
            </h3>
            <ProductCarousel products={categoryProducts.get(catName) || []} />
          </div>
        ))}
      </section>
    </AnimatedPage>
  );
}
