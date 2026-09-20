"use client";

import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime";

export type Member = { id: string; name: string };

/**
 * Who has weighed in, live. Votes land several at a time when someone submits,
 * so this refetches the voter list on any change rather than counting rows.
 */
export function Roster({
  roundId,
  members,
  voterIds,
}: {
  roundId: string;
  members: Member[];
  voterIds: string[];
}) {
  // Seeded from the server on every render, then kept current by the channel.
  const [liveVoterIds, setLiveVoterIds] = useState<string[] | null>(null);
  const voted = new Set(liveVoterIds ?? voterIds);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase
        .from("votes")
        .select("user_id")
        .eq("round_id", roundId);
      if (data && !cancelled) {
        setLiveVoterIds([...new Set(data.map((vote) => vote.user_id))]);
      }
    };

    void (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(`votes:${roundId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "votes", filter: `round_id=eq.${roundId}` },
          refresh,
        )
        .subscribe((status) => {
          // Quiet when healthy. A channel that dies is otherwise invisible —
          // the screen just quietly stops keeping up.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[votes] realtime channel", status);
          }
        });

      // Catch anything that landed between the server render and the join.
      await refresh();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roundId]);

  return (
    <ul className="mt-3 border-t border-line">
      {members.map((member) => {
        const hasVoted = voted.has(member.id);
        return (
          <li
            key={member.id}
            className="flex items-center gap-3 border-b border-line-soft py-3"
          >
            {hasVoted ? (
              <Check size={18} className="shrink-0 text-olive" aria-hidden />
            ) : (
              <Circle size={18} className="shrink-0 text-ink-faint" aria-hidden />
            )}
            <span className="flex-1 font-display text-[18px] text-ink">
              {member.name}
            </span>
            <span className="text-[13px] text-ink-faint">
              {hasVoted ? "voted" : "still deciding"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
