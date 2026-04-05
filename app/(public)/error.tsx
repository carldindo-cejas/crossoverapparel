"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PublicError]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-5xl">⚠️</p>
      <h2 className="mt-6 text-2xl font-semibold text-neutral-900">Something went wrong</h2>
      <p className="mt-3 text-sm text-neutral-600">
        An unexpected error occurred. Please try again or contact us if the problem persists.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-neutral-400">Error ID: {error.digest}</p>
      )}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
