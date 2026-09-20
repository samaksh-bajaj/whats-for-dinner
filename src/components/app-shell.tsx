"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, NotebookText, UsersRound, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tabs = [
  { href: "/tonight", label: "Tonight", Icon: UtensilsCrossed },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/dishes", label: "Dishes", Icon: NotebookText },
  { href: "/household", label: "Household", Icon: UsersRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-ground">
      {/* Bottom padding clears the fixed nav (64px) plus the home indicator. */}
      <main className="flex-1 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[440px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="flex">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                    active ? "text-paprika" : "text-ink-faint hover:text-ink-soft",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
