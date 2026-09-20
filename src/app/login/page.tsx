import type { Metadata } from "next";
import { BackToStart, LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — What's for Dinner?" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const destination = typeof next === "string" ? next : "/tonight";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <BackToStart />

      <h1 className="mt-10 font-display text-[40px] leading-[1.05] font-semibold text-ink">
        Sign in
      </h1>

      <LoginForm next={destination} linkFailed={error === "link"} />
    </main>
  );
}
