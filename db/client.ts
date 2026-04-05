export interface WorkerEnv {
  DB: D1Database;
  ASSETS?: R2Bucket;
  PRODUCT_IMAGES?: R2Bucket;
  ORDER_FILES?: R2Bucket;
  PAYMENT_RECEIPTS?: R2Bucket;
  PRESENCE_HUB: DurableObjectNamespace;
  AUTH_SECRET: string;
  R2_PUBLIC_BASE_URL?: string;
  REALTIME_API_URL?: string;
  REALTIME_API_TOKEN?: string;
  SEED_KEY?: string;
}

export function getDb(env: WorkerEnv): D1Database {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }

  return env.DB;
}
