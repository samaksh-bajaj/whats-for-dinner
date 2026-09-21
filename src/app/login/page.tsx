import type { Metadata } from "next";
import Image from "next/image";
import { BackToStart, LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — What's Cooking?" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const destination = typeof next === "string" ? next : "/tonight";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Back on the left, the mark on the right: the only signed-out page
          besides the landing, so it gets the same signature and nothing more. */}
      <div className="flex items-center justify-between">
        <BackToStart />
        <Image
          src="/mark.svg"
          alt=""
          width={1841}
          height={1680}
          className="h-auto w-[48px]"
        />
      </div>

      <h1 className="mt-10 font-display text-[40px] leading-[1.05] font-semibold text-ink">
        Sign in
      </h1>

      <LoginForm next={destination} linkFailed={error === "link"} />
    </main>
  );
}
