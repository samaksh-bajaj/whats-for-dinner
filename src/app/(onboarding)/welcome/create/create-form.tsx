"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { TimezoneField } from "@/components/timezone-field";
import { createHousehold, type FormState } from "@/lib/household-actions";

export function CreateHouseholdForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createHousehold,
    null,
  );

  return (
    <form action={formAction} className="mt-8 flex flex-1 flex-col gap-5">
      <Field
        id="name"
        name="name"
        label="Household name"
        placeholder="Prancy Creek"
        defaultValue={state?.values?.name ?? ""}
        maxLength={60}
        autoFocus
        required
      />

      <TimezoneField />

      <Field
        id="password"
        name="password"
        type="password"
        label="Household password"
        autoComplete="new-password"
        minLength={4}
        required
        hint="Everyone joining types this once. Say it out loud, don't email it."
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <div className="mt-auto pt-8">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && (
            <LoaderCircle size={18} className="animate-spin" aria-hidden />
          )}
          {pending ? "Setting up" : "Create household"}
        </Button>
      </div>
    </form>
  );
}
