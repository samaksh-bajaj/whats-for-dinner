import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JoinHouseholdForm } from "./join-form";
import { requireNoHousehold } from "@/lib/household";

export default async function JoinHouseholdPage() {
  await requireNoHousehold();

  return (
    <>
      <Link
        href="/welcome"
        className="inline-flex items-center gap-1.5 text-[14px] text-ink-faint hover:text-ink-soft"
      >
        <ArrowLeft size={15} aria-hidden />
        Back
      </Link>

      <h1 className="mt-8 font-display text-[34px] leading-tight font-semibold text-ink">
        Join a household
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        Whoever set it up has the code and the password. Both are on their
        Household screen.
      </p>

      <JoinHouseholdForm />
    </>
  );
}
