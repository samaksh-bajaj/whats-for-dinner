import { Angry, CircleDashed, Frown, Laugh, Meh, Smile } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Taste } from "@/lib/scoring/taste";

// Faces, not emoji — lucide icons with words beside them, so this reads the
// same to someone using a screen reader as it does to everyone else. Nothing
// here is a control: it is what the app has worked out about you from voting,
// shown so the evening's winner is never a black box.
const BANDS = [
  { from: 1.2, label: "Love it", Icon: Laugh, tone: "text-olive" },
  { from: 0.4, label: "Like it", Icon: Smile, tone: "text-olive" },
  { from: -0.4, label: "Fine", Icon: Meh, tone: "text-ink-soft" },
  { from: -1.2, label: "Not for me", Icon: Frown, tone: "text-paprika" },
  { from: -Infinity, label: "Never again", Icon: Angry, tone: "text-paprika" },
] as const;

/** Nothing voted on, or nothing voted on recently enough to still mean it. */
const LEARNING = { label: "Learning", Icon: CircleDashed, tone: "text-ink-faint" } as const;

const CONFIDENT_AT = 6;
const FAIRLY_SURE_AT = 3;
/**
 * One vote is worth saying out loud — it is what the shrinkage already treats
 * as a hint rather than a verdict. Deliberately under 1 rather than at it: a
 * vote cast yesterday weighs 0.99, and "you said yuck last night" must not
 * come back as "no idea yet". Half is roughly a single opinion ten weeks old.
 */
const ENOUGH_TO_SPEAK_AT = 0.5;

export function tasteBand(taste: Taste | undefined) {
  if (!taste || taste.weight < ENOUGH_TO_SPEAK_AT) return LEARNING;
  return BANDS.find((band) => taste.value >= band.from)!;
}

/** Three dots: how much voting is behind the face. */
function confidence(taste: Taste | undefined) {
  const weight = taste?.weight ?? 0;
  if (weight >= CONFIDENT_AT) return 3;
  if (weight >= FAIRLY_SURE_AT) return 2;
  if (weight >= ENOUGH_TO_SPEAK_AT) return 1;
  return 0;
}

export function TasteBadge({
  taste,
  showDots = true,
}: {
  taste: Taste | undefined;
  showDots?: boolean;
}) {
  const { label, Icon, tone } = tasteBand(taste);
  const filled = confidence(taste);

  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={20} strokeWidth={1.75} className={cn("shrink-0", tone)} aria-hidden />
      <span className="text-[14px] text-ink-soft">{label}</span>
      {showDots && (
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${filled} of 3 on how sure we are`}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={cn(
                "size-1.5 rounded-full",
                dot < filled ? "bg-ink-soft" : "bg-line",
              )}
              aria-hidden
            />
          ))}
        </span>
      )}
    </span>
  );
}

/** The same face on its own, for a dense list where the words don't fit. */
export function TasteIcon({ taste }: { taste: Taste | undefined }) {
  const { label, Icon, tone } = tasteBand(taste);
  return <Icon size={20} strokeWidth={1.75} className={cn("shrink-0", tone)} aria-label={label} />;
}
