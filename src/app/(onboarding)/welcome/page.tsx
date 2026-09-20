import Link from "next/link";
import { ChefHat, DoorOpen } from "lucide-react";

export default function WelcomePage() {
  return (
    <>
      <h1 className="font-display text-[40px] leading-[1.05] font-semibold text-ink">
        One household,
        <br />
        one dinner
      </h1>
      <p className="mt-5 max-w-[34ch] text-[17px] leading-relaxed text-ink-soft">
        Start a household and invite the people you cook with, or join the one
        that already has your kitchen in it.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <Link
          href="/welcome/create"
          className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink-faint"
        >
          <ChefHat size={22} className="shrink-0 text-paprika" aria-hidden />
          <span>
            <span className="block font-display text-[20px] text-ink">
              Start a household
            </span>
            <span className="mt-0.5 block text-[14px] text-ink-soft">
              You pick the name and the password
            </span>
          </span>
        </Link>

        <Link
          href="/welcome/join"
          className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink-faint"
        >
          <DoorOpen size={22} className="shrink-0 text-olive" aria-hidden />
          <span>
            <span className="block font-display text-[20px] text-ink">
              Join one
            </span>
            <span className="mt-0.5 block text-[14px] text-ink-soft">
              With the six-character code and password
            </span>
          </span>
        </Link>
      </div>

      <p className="mt-auto pt-10 text-[13px] leading-relaxed text-ink-faint">
        You can be in one household at a time — the app is built around a single
        kitchen and the people who eat in it.
      </p>
    </>
  );
}
