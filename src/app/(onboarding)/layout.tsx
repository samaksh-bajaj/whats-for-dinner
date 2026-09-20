import { redirect } from "next/navigation";
import { getViewer } from "@/lib/household";
import type { ReactNode } from "react";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Already settled in somewhere — nothing to onboard.
  if (viewer.household) redirect("/tonight");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
