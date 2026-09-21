import Link from "next/link";
import { CalendarCheck, UtensilsCrossed } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { listActiveDishes } from "@/lib/dishes";
import { getRound, householdToday } from "@/lib/rounds";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VoteChoice } from "@/lib/scoring/config";
import { Ballot, type BallotDish } from "./ballot";
import { EndRoundButton } from "./end-round-button";
import { Roster, type Member } from "./roster";
import { RoundWatcher } from "./round-watcher";
import { StartRoundButton } from "./start-round-button";

export default async function TonightPage() {
  const { user, household } = await requireHousehold();
  // Nothing stands between a member and the ballot. Taste is learned from the
  // votes themselves, so someone who joined an hour ago votes tonight.
  const dishes = await listActiveDishes();

  const supabase = await createSupabaseServerClient();
  const today = householdToday(household);
  const round = await getRound(household.id, today);

  const heading = (
    <h1 className="font-display text-[34px] font-semibold text-ink">Tonight</h1>
  );

  if (dishes.length === 0) {
    return (
      <>
        {heading}
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          There&rsquo;s nothing to choose between yet.{" "}
          <Link href="/dishes" className="text-paprika underline">
            Add a few dishes
          </Link>{" "}
          and tonight&rsquo;s round can start.
        </p>
      </>
    );
  }

  if (!round) {
    return (
      <>
        <RoundWatcher householdId={household.id} />
        {heading}
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          No round yet. Starting one draws six dishes from the list and freezes
          them &mdash; anyone at the table can do it, and anyone can call time
          once people have voted.
        </p>
        <StartRoundButton />
      </>
    );
  }

  const { data: roster } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .order("joined_at");
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const members: Member[] = (roster ?? []).map((entry) => ({
    id: entry.user_id,
    name:
      profiles?.find((profile) => profile.id === entry.user_id)?.display_name ??
      "Someone",
  }));

  if (round.status === "closed") {
    const { data: winner } = round.winner_dish_id
      ? await supabase
          .from("dishes")
          .select("name, note")
          .eq("id", round.winner_dish_id)
          .maybeSingle()
      : { data: null };

    // The result is the dish and nothing else. No scores, no runners-up,
    // nothing to relitigate over the washing up.
    return (
      <>
        <RoundWatcher householdId={household.id} />
        {heading}
        <div className="mt-10 rounded-card border border-line bg-surface p-6 text-center">
          <CalendarCheck size={22} className="mx-auto text-olive" aria-hidden />
          <p className="mt-4 text-[14px] text-ink-soft">Tonight you&rsquo;re having</p>
          <p className="mt-2 font-display text-[40px] leading-[1.1] font-semibold text-ink">
            {winner?.name ?? "something"}
          </p>
          {winner?.note && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {winner.note}
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-[14px] text-ink-faint">
          Settled. Tomorrow is a fresh round.
        </p>
      </>
    );
  }

  const [{ data: ballot }, { data: myVotes }, { data: allVotes }] = await Promise.all([
    supabase
      .from("round_dishes")
      .select("dish_id, created_at, dishes(name, note)")
      .eq("round_id", round.id)
      .order("created_at"),
    supabase
      .from("votes")
      .select("dish_id, choice")
      .eq("round_id", round.id)
      .eq("user_id", user.id),
    supabase.from("votes").select("user_id").eq("round_id", round.id),
  ]);

  const ballotDishes: BallotDish[] = (ballot ?? []).map((entry) => ({
    id: entry.dish_id,
    name: entry.dishes?.name ?? "A dish",
    note: entry.dishes?.note ?? null,
  }));

  const initialChoices = Object.fromEntries(
    (myVotes ?? []).map((vote) => [vote.dish_id, vote.choice as VoteChoice]),
  );
  const voterIds = [...new Set((allVotes ?? []).map((vote) => vote.user_id))];

  return (
    <>
      <RoundWatcher householdId={household.id} />
      <div className="flex items-baseline justify-between">
        {heading}
        <span className="flex items-center gap-1.5 text-[13px] text-ink-faint">
          <UtensilsCrossed size={14} aria-hidden />
          {ballotDishes.length} up
        </span>
      </div>

      <Ballot
        roundId={round.id}
        dishes={ballotDishes}
        initialChoices={initialChoices}
      />

      <section className="mt-10">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          At the table
        </h2>
        <Roster roundId={round.id} members={members} voterIds={voterIds} />
      </section>

      <EndRoundButton roundId={round.id} anyVotes={voterIds.length > 0} />
    </>
  );
}
