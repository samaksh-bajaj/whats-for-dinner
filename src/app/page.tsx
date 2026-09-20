import Link from "next/link";

// A week of a fictional household's ledger — the thing the app actually
// produces. It says what this is faster than a feature list would.
const sampleWeek = [
  { day: "Mon", dish: "Rajma chawal" },
  { day: "Tue", dish: "Lemon pasta" },
  { day: "Wed", dish: "Bhindi & roti" },
  { day: "Thu", dish: "Khichdi" },
  { day: "Fri", dish: "Chicken curry" },
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="font-display text-[54px] leading-[0.95] font-semibold text-ink">
        What&rsquo;s for
        <br />
        dinner?
      </h1>

      <p className="mt-6 max-w-[34ch] text-[17px] leading-relaxed text-ink-soft">
        Your household asks it every single evening. Settle it together in under
        a minute &mdash; everyone votes, nobody negotiates.
      </p>

      <div className="mt-12 border-t border-line">
        {sampleWeek.map(({ day, dish }) => (
          <div
            key={day}
            className="flex items-baseline gap-4 border-b border-line-soft py-3"
          >
            <span className="tnum w-9 shrink-0 text-[13px] text-ink-faint">
              {day}
            </span>
            <span className="font-display text-[19px] text-ink">{dish}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-12">
        <Link
          href="/login"
          className="flex h-[52px] w-full items-center justify-center rounded-xl bg-paprika text-[17px] font-medium text-surface transition-colors hover:bg-paprika-deep"
        >
          Get started
        </Link>
        <p className="mt-4 text-center text-[14px] text-ink-faint">
          We&rsquo;ll email you a link to sign in. No password to remember.
        </p>
      </div>
    </main>
  );
}
