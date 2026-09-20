import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6">
      <h1 className="font-display text-[32px] leading-tight font-semibold text-ink">
        Nothing here
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        This page doesn&rsquo;t exist, or it belongs to a household
        you&rsquo;re not in.
      </p>
      <Link
        href="/tonight"
        className="mt-8 flex h-[52px] w-full items-center justify-center rounded-xl bg-paprika text-[17px] font-medium text-surface transition-colors hover:bg-paprika-deep"
      >
        Back to tonight
      </Link>
    </main>
  );
}
