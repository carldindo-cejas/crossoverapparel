"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DesignerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DesignerError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl font-semibold text-neutral-900">An error occurred</h2>
      <p className="text-sm text-neutral-600">
        {error.message || "Something went wrong in the designer panel."}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-neutral-400">ID: {error.digest}</p>
      )}
      <Button size="sm" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
