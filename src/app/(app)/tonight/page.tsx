import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { listActiveDishes, unratedDishes } from "@/lib/dishes";

export default async function TonightPage() {
  const { user } = await requireHousehold();
  const [dishes, unrated] = await Promise.all([
    listActiveDishes(),
    unratedDishes(user.id),
  ]);

  // The hard gate: no voting while you still owe the list an opinion.
  if (unrated.length > 0) redirect("/rate");

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold text-ink">
        Tonight
      </h1>

      {dishes.length === 0 ? (
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          There&rsquo;s nothing to choose between yet.{" "}
          <Link href="/dishes" className="text-paprika underline">
            Add a few dishes
          </Link>{" "}
          and tonight&rsquo;s round can start.
        </p>
      ) : (
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          Everything&rsquo;s rated. Starting a round lands here next.
        </p>
      )}
    </>
  );
}
