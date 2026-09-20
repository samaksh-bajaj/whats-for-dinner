"use client";

import { useActionState, useState } from "react";
import { Heart, LoaderCircle, Minus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { submitVotesAction, type RoundActionState } from "@/lib/round-actions";
import type { VoteChoice } from "@/lib/scoring/config";

export type BallotDish = { id: string; name: string; note: string | null };

const CHOICES = [
  { choice: "yum", label: "Yum", Icon: Heart, tone: "text-olive", border: "border-olive" },
  { choice: "meh", label: "Meh", Icon: Minus, tone: "text-ink-soft", border: "border-ink-soft" },
  { choice: "yuck", label: "Yuck", Icon: X, tone: "text-paprika", border: "border-paprika" },
] as const;

export function Ballot({
  roundId,
  dishes,
  initialChoices,
}: {
  roundId: string;
  dishes: BallotDish[];
  initialChoices: Record<string, VoteChoice>;
}) {
  const [choices, setChoices] = useState(initialChoices);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(Object.keys(initialChoices).length === 0);

  const [state, formAction, pending] = useActionState<RoundActionState, FormData>(
    async (previous, formData) => {
      const result = await submitVotesAction(previous, formData);
      if (!result) setEditing(false);
      return result;
    },
    null,
  );

  const answered = dishes.filter((dish) => choices[dish.id]).length;
  const complete = answered === dishes.length;

  if (!editing) {
    return (
      <section className="mt-8">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Your votes are in
        </h2>
        <ul className="mt-3 border-t border-line">
          {dishes.map((dish) => {
            const picked = CHOICES.find((option) => option.choice === choices[dish.id]);
            return (
              <li
                key={dish.id}
                className="flex items-center gap-3 border-b border-line-soft py-3"
              >
                {picked && (
                  <picked.Icon
                    size={18}
                    className={cn("shrink-0", picked.tone)}
                    aria-label={picked.label}
                  />
                )}
                <span className="flex-1 truncate font-display text-[18px] text-ink">
                  {dish.name}
                </span>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="mt-4"
          onClick={() => {
            setEditing(true);
            setIndex(0);
          }}
        >
          <Pencil size={15} aria-hidden />
          Change my votes
        </Button>
      </section>
    );
  }

  const dish = dishes[index];

  return (
    <section className="mt-8">
      {/* Progress dots: where you are in the six, and what you've answered. */}
      <ol className="flex gap-1.5" aria-label={`Dish ${index + 1} of ${dishes.length}`}>
        {dishes.map((each, position) => (
          <li
            key={each.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              position === index
                ? "bg-ink"
                : choices[each.id]
                  ? "bg-ink-faint"
                  : "bg-line",
            )}
          />
        ))}
      </ol>

      <p className="mt-8 font-display text-[36px] leading-[1.1] font-semibold text-ink">
        {dish.name}
      </p>
      {dish.note && (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{dish.note}</p>
      )}

      <div className="mt-8 flex gap-2">
        {CHOICES.map(({ choice, label, Icon, tone, border }) => {
          const picked = choices[dish.id] === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={picked}
              onClick={() => {
                setChoices((current) => ({ ...current, [dish.id]: choice }));
                // Move along on its own — six dishes should take one pass.
                if (index < dishes.length - 1) setIndex(index + 1);
              }}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-card border bg-surface py-5 transition-colors",
                picked ? `${border} bg-surface` : "border-line hover:border-ink-faint",
              )}
            >
              <Icon
                size={26}
                strokeWidth={picked ? 2.5 : 1.75}
                className={picked ? tone : "text-ink-faint"}
                aria-hidden
              />
              <span className={cn("text-[13px]", picked ? "text-ink" : "text-ink-faint")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          Back
        </Button>
        <span className="tnum text-[13px] text-ink-faint">
          {answered} of {dishes.length} answered
        </span>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={index === dishes.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Next
        </Button>
      </div>

      <form action={formAction} className="mt-6">
        <input type="hidden" name="round_id" value={roundId} />
        <input type="hidden" name="choices" value={JSON.stringify(choices)} />
        {state?.error && <FormError>{state.error}</FormError>}
        <Button type="submit" size="lg" disabled={!complete || pending}>
          {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden />}
          {pending ? "Sending" : complete ? "Send my votes" : "Answer them all first"}
        </Button>
      </form>
    </section>
  );
}
