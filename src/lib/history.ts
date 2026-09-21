import { monthBounds, type Month } from "@/lib/calendar";
import { decayed } from "@/lib/scoring/karma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CookedDay = { date: string; roundId: string; dishName: string };

/** What got cooked on each day of a month, keyed by date. */
export async function cookedInMonth(month: Month) {
  const supabase = await createSupabaseServerClient();
  const { first, last } = monthBounds(month);

  const { data } = await supabase
    .from("rounds")
    .select("id, round_date, winner_dish_id, dishes!rounds_winner_dish_id_fkey(name)")
    .eq("status", "closed")
    .not("winner_dish_id", "is", null)
    .gte("round_date", first)
    .lte("round_date", last);

  const byDate = new Map<string, CookedDay>();
  for (const round of data ?? []) {
    byDate.set(round.round_date, {
      date: round.round_date,
      roundId: round.id,
      dishName: round.dishes?.name ?? "something",
    });
  }
  return byDate;
}

export type DayDetail = {
  date: string;
  dishName: string;
  note: string | null;
  voters: string[];
  absentees: string[];
};

/** One evening in full: what was cooked, and who had a say in it. */
export async function dayDetail(date: string): Promise<DayDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: round } = await supabase
    .from("rounds")
    .select("id, round_date, winner_dish_id, dishes!rounds_winner_dish_id_fkey(name, note)")
    .eq("round_date", date)
    .eq("status", "closed")
    .maybeSingle();

  if (!round?.winner_dish_id) return null;

  const [{ data: votes }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("votes").select("user_id").eq("round_id", round.id),
    supabase.from("household_members").select("user_id").order("joined_at"),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const nameOf = (id: string) =>
    profiles?.find((profile) => profile.id === id)?.display_name ?? "Someone";
  const voterIds = new Set((votes ?? []).map((vote) => vote.user_id));

  return {
    date,
    dishName: round.dishes?.name ?? "something",
    note: round.dishes?.note ?? null,
    voters: (members ?? [])
      .filter((member) => voterIds.has(member.user_id))
      .map((member) => nameOf(member.user_id)),
    absentees: (members ?? [])
      .filter((member) => !voterIds.has(member.user_id))
      .map((member) => nameOf(member.user_id)),
  };
}

export type KarmaRow = { memberId: string; name: string; value: number };

/**
 * Karma as it stands today. Decayed for display only — the stored value is
 * brought up to date when a round is actually settled.
 */
export async function karmaBoard(today: string): Promise<KarmaRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: karma }, { data: profiles }] = await Promise.all([
    supabase.from("member_karma").select("user_id, value, last_decay_on"),
    supabase.from("profiles").select("id, display_name"),
  ]);

  return (karma ?? [])
    .map((row) => ({
      memberId: row.user_id,
      name:
        profiles?.find((profile) => profile.id === row.user_id)?.display_name ??
        "Someone",
      value: decayed(
        { memberId: row.user_id, value: Number(row.value), lastDecayOn: row.last_decay_on },
        today,
      ).value,
    }))
    .sort((a, b) => b.value - a.value);
}

export type DishStat = {
  id: string;
  name: string;
  timesCooked: number;
  lastCookedOn: string | null;
};

/**
 * Times cooked and when, per dish. Deliberately no taste figure: what the
 * household collectively thinks of a dish is an input to the formula, not a
 * scoreboard, and publishing it invites people to play the number rather than
 * say what they actually want. Your own taste is yours to see, on /dishes.
 */
export async function dishStats(): Promise<DishStat[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: dishes }, { data: rounds }] = await Promise.all([
    supabase.from("dishes").select("id, name").is("archived_at", null).order("name"),
    supabase
      .from("rounds")
      .select("round_date, winner_dish_id")
      .eq("status", "closed")
      .not("winner_dish_id", "is", null),
  ]);

  const cooked = new Map<string, { count: number; last: string }>();
  for (const round of rounds ?? []) {
    const id = round.winner_dish_id!;
    const previous = cooked.get(id);
    cooked.set(id, {
      count: (previous?.count ?? 0) + 1,
      last:
        previous && previous.last > round.round_date ? previous.last : round.round_date,
    });
  }

  return (dishes ?? [])
    .map((dish) => {
      return {
        id: dish.id,
        name: dish.name,
        timesCooked: cooked.get(dish.id)?.count ?? 0,
        lastCookedOn: cooked.get(dish.id)?.last ?? null,
      };
    })
    .sort((a, b) => b.timesCooked - a.timesCooked || a.name.localeCompare(b.name));
}
