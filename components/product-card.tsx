import Link from "next/link";
import { motion } from "framer-motion";
import { Product } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

type ProductCardProps = {
  product: Product;
};

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

export function ProductCard({ product }: ProductCardProps) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link href={`/custom-order?productId=${product.id}`}>
        <Card className="overflow-hidden border-neutral-200 transition-shadow hover:shadow-xl hover:shadow-neutral-200/70">
          <div className="relative aspect-[4/5] bg-neutral-100">
            {product.image_url ? (
              <img
                src={`/api/products/images/${product.image_url}`}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#f5f5f5,transparent_50%),radial-gradient(circle_at_80%_80%,#ececec,transparent_45%),linear-gradient(120deg,#f8f8f8,#eaeaea)]">
                <span className="text-5xl text-neutral-200">📷</span>
              </div>
            )}
          </div>
          <CardContent className="space-y-3">
            <Badge>{product.category_name || "Apparel"}</Badge>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">{product.name}</h3>
              <p className="text-sm text-neutral-500 line-clamp-2">
                {product.description || "Performance fabrics and customization options available."}
              </p>
            </div>
            <StarRating rating={product.rating ?? 0} />
            <p className="text-base font-semibold text-neutral-900">
              {formatCurrency(product.base_price_cents, product.currency)}
            </p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
