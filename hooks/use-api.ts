"use client";

import { useEffect, useState } from "react";

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        const response = await fetch(url, { cache: "no-store" });
        const payload = (await response.json()) as { success: boolean; data?: T; error?: { message: string } };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "Request failed");
        }

        if (mounted) {
          setData(payload.data ?? null);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [url]);

  return { data, loading, error };
}
