import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HouseholdPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects signed-out visitors; this is the check that
  // actually guards the data, since a Server Function is reachable on its own.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold text-ink">
        Household
      </h1>

      <div className="mt-8 rounded-card border border-line bg-surface p-5">
        <p className="text-[13px] text-ink-faint">Signed in as</p>
        <p className="mt-1 font-display text-[22px] text-ink">
          {profile?.display_name ?? "Cook"}
        </p>
        <p className="mt-0.5 text-[14px] text-ink-soft">{user.email}</p>
      </div>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
        Creating and joining a household lands here next.
      </p>

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="quiet" size="sm">
          <LogOut size={16} aria-hidden />
          Sign out
        </Button>
      </form>
    </>
  );
}
