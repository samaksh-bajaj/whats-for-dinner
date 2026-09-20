"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime";

/**
 * Keeps everyone's screen on the same evening: when one person starts the
 * round or ends it, every other phone re-renders instead of sitting on a
 * stale page until someone thinks to reload.
 */
export function RoundWatcher({ householdId }: { householdId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    void (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(`rounds:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rounds",
            filter: `household_id=eq.${householdId}`,
          },
          () => router.refresh(),
        )
        .subscribe((status) => {
          // Quiet when healthy. A channel that dies is otherwise invisible —
          // the screen just quietly stops keeping up.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[rounds] realtime channel", status);
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, router]);

  return null;
}
