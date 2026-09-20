"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { endRoundAction, type RoundActionState } from "@/lib/round-actions";

/**
 * Two steps on purpose. Ending the round locks out anyone still deciding, so
 * it should not be something a thumb does by accident on a phone.
 */
export function EndRoundButton({
  roundId,
  anyVotes,
}: {
  roundId: string;
  anyVotes: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<RoundActionState, FormData>(
    endRoundAction,
    null,
  );

  if (!anyVotes) {
    return (
      <div className="mt-8 border-t border-line pt-6">
        <Button type="button" variant="secondary" size="md" disabled>
          End voting
        </Button>
        <p className="mt-2 text-[13px] text-ink-faint">
          Someone has to vote before the night can be decided.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-line pt-6">
      {confirming ? (
        <form action={formAction}>
          <input type="hidden" name="round_id" value={roundId} />
          <p className="text-[15px] leading-relaxed text-ink">
            End it now? Anyone who hasn&rsquo;t voted will be left out of the
            result.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="submit" variant="danger" size="md" disabled={pending}>
              {pending && (
                <LoaderCircle size={16} className="animate-spin" aria-hidden />
              )}
              {pending ? "Deciding" : "Yes, end voting"}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="md"
              onClick={() => setConfirming(false)}
            >
              Not yet
            </Button>
          </div>
          {state?.error && <FormError>{state.error}</FormError>}
        </form>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setConfirming(true)}
          >
            End voting
          </Button>
          <p className="mt-2 text-[13px] text-ink-faint">
            Any member can call it. Whoever hasn&rsquo;t voted is left out.
          </p>
        </>
      )}
    </div>
  );
}
