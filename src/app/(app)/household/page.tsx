import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";
import { requireHousehold } from "@/lib/household";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CopyCode,
  DisplayNameForm,
  RenameHouseholdForm,
} from "./household-forms";

export default async function HouseholdPage() {
  const { user, household } = await requireHousehold();
  const supabase = await createSupabaseServerClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .order("joined_at");

  // household_members.user_id points at auth.users, not profiles, so there is
  // no relationship for PostgREST to follow — two queries it is.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const nameOf = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);
  const isLeader = household.leader_id === user.id;
  const you = nameOf.get(user.id) ?? "Cook";

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold text-ink">
        Household
      </h1>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Name
        </h2>
        {isLeader ? (
          <RenameHouseholdForm householdId={household.id} name={household.name} />
        ) : (
          <p className="mt-3 font-display text-[24px] text-ink">
            {household.name}
          </p>
        )}
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
            Join code
          </h2>
          <CopyCode code={household.join_code} />
        </div>
        <p className="tnum mt-2 font-display text-[34px] tracking-[0.22em] text-ink">
          {household.join_code}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          Give this and the household password to anyone joining. The password
          isn&rsquo;t shown here — only you know it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          At this table
        </h2>
        <ul className="mt-3 border-t border-line">
          {members?.map((member) => (
            <li
              key={member.user_id}
              className="flex items-baseline justify-between border-b border-line-soft py-3"
            >
              <span className="font-display text-[19px] text-ink">
                {nameOf.get(member.user_id) ?? "Someone"}
              </span>
              {household.leader_id === member.user_id && (
                <span className="text-[12px] tracking-wide text-ink-faint uppercase">
                  Leader
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Your name
        </h2>
        <DisplayNameForm displayName={you} />
        <p className="mt-2 text-[13px] text-ink-faint">
          What your housemates see next to a vote. Signed in as {user.email}.
        </p>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <p className="text-[13px] text-ink-faint">
          Timezone: {household.timezone.replace(/_/g, " ")}
        </p>
        <form action={signOut} className="mt-4">
          <Button type="submit" variant="quiet" size="sm">
            <LogOut size={16} aria-hidden />
            Sign out
          </Button>
        </form>
      </section>
    </>
  );
}
