import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getViewer } from "@/lib/household";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Signed in but homeless: nothing in here means anything yet.
  if (!viewer.household) redirect("/welcome");

  return <AppShell>{children}</AppShell>;
}
