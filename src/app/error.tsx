"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Whatever went wrong, the person deserves the detail to be somewhere.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6">
      <h1 className="font-display text-[32px] leading-tight font-semibold text-ink">
        That didn&rsquo;t work
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        Something went wrong on our side. Nothing you did caused it, and
        nothing you&rsquo;ve voted on is lost.
      </p>
      <div className="mt-8">
        <Button type="button" onClick={reset} size="lg">
          <RotateCw size={18} aria-hidden />
          Try again
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 text-center text-[12px] text-ink-faint">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
