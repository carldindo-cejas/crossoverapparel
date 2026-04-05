import { AppError } from "@/lib/errors";
import type { WorkerEnv } from "@/db/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type GlobalWithEnv = typeof globalThis & {
  __CLOUDFLARE_ENV__?: Partial<WorkerEnv>;
};

export function getWorkerEnv(): WorkerEnv {
  const globalEnv = (globalThis as GlobalWithEnv).__CLOUDFLARE_ENV__;
  const cloudflareEnv = globalEnv ?? (getCloudflareContext().env as Partial<WorkerEnv> | undefined);

  if (!cloudflareEnv?.DB) {
    throw new AppError(
      "Cloudflare environment is not configured. Provide DB and required bindings.",
      500,
      "ENV_MISSING"
    );
  }

  if (!cloudflareEnv?.PRESENCE_HUB) {
    throw new AppError("PRESENCE_HUB binding is not configured", 500, "ENV_MISSING");
  }

  if (!cloudflareEnv.AUTH_SECRET) {
    throw new AppError("AUTH_SECRET is not configured. Run: wrangler secret put AUTH_SECRET", 500, "ENV_MISSING");
  }

  return {
    DB: cloudflareEnv.DB,
    ASSETS: cloudflareEnv.ASSETS,
    PRODUCT_IMAGES: cloudflareEnv.PRODUCT_IMAGES,
    ORDER_FILES: cloudflareEnv.ORDER_FILES,
    PAYMENT_RECEIPTS: cloudflareEnv.PAYMENT_RECEIPTS,
    PRESENCE_HUB: cloudflareEnv.PRESENCE_HUB,
    AUTH_SECRET: cloudflareEnv.AUTH_SECRET,
    R2_PUBLIC_BASE_URL: cloudflareEnv.R2_PUBLIC_BASE_URL,
    REALTIME_API_URL: cloudflareEnv.REALTIME_API_URL,
    REALTIME_API_TOKEN: cloudflareEnv.REALTIME_API_TOKEN,
    SEED_KEY: cloudflareEnv.SEED_KEY,
  };
}
