"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { joinHousehold, type FormState } from "@/lib/household-actions";

export function JoinHouseholdForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    joinHousehold,
    null,
  );

  return (
    <form action={formAction} className="mt-8 flex flex-1 flex-col gap-5">
      <Field
        id="code"
        name="code"
        label="Join code"
        placeholder="5ZYC2N"
        defaultValue={state?.values?.code ?? ""}
        maxLength={6}
        minLength={6}
        autoFocus
        required
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputClassName="font-display text-[24px] tracking-[0.3em] uppercase"
      />

      <Field
        id="password"
        name="password"
        type="password"
        label="Household password"
        autoComplete="current-password"
        required
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <div className="mt-auto pt-8">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && (
            <LoaderCircle size={18} className="animate-spin" aria-hidden />
          )}
          {pending ? "Joining" : "Join household"}
        </Button>
      </div>
    </form>
  );
}
