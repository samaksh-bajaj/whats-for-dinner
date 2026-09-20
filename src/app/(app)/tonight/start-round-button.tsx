"use client";

import { useActionState } from "react";
import { LoaderCircle, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { startRoundAction, type RoundActionState } from "@/lib/round-actions";

export function StartRoundButton() {
  const [state, formAction, pending] = useActionState<RoundActionState, FormData>(
    startRoundAction,
    null,
  );

  return (
    <form action={formAction} className="mt-8">
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <LoaderCircle size={18} className="animate-spin" aria-hidden />
        ) : (
          <UtensilsCrossed size={18} aria-hidden />
        )}
        {pending ? "Drawing the six" : "Start tonight's vote"}
      </Button>
    </form>
  );
}
