import type { Metadata } from "next";
import { getWorkerEnv } from "@/lib/env";
import { getDb } from "@/db/client";
import { sqlFirst } from "@/db/raw";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  try {
    const { productId } = await params;
    const env = getWorkerEnv();
    const db = getDb(env);
    const product = await sqlFirst<{
      name: string;
      description: string | null;
      base_price_cents: number;
    }>(
      db,
      `SELECT name, description, base_price_cents
       FROM products WHERE id = ? AND status = 'active' LIMIT 1`,
      [productId]
    );
    if (!product) return { title: "Order Teamwear" };
    return {
      title: product.name,
      description:
        product.description ||
        `Order custom ${product.name} for your team. Starting from ₱${Math.floor(product.base_price_cents / 100).toLocaleString()}.`,
      openGraph: {
        title: `${product.name} | Crossover Apparel`,
        description:
          product.description ||
          `High-quality custom teamwear. Starting from ₱${Math.floor(product.base_price_cents / 100).toLocaleString()}.`,
        type: "website",
      },
    };
  } catch {
    return { title: "Order Teamwear" };
  }
}

export default function ProductOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
