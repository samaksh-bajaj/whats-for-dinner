import { redirect } from "next/navigation";
import { getViewer } from "@/lib/household";
import type { ReactNode } from "react";

/**
 * The bare shell: full-bleed screens with no tab bar, for the steps that come
 * before (or interrupt) the app proper. Each page decides what it requires —
 * /welcome wants someone without a household, /rate wants someone with one.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
