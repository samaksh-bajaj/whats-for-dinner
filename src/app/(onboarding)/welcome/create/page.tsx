import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateHouseholdForm } from "./create-form";

export default function CreateHouseholdPage() {
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
        Start a household
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        You&rsquo;ll be its leader: you can rename it and tidy anyone&rsquo;s
        dishes. Everything else is everyone&rsquo;s.
      </p>

      <CreateHouseholdForm />
    </>
  );
}
