"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { updateDish, type DishFormState } from "@/lib/dish-actions";

export function EditDishForm({
  dishId,
  name,
  note,
}: {
  dishId: string;
  name: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState<DishFormState, FormData>(
    updateDish,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="dish_id" value={dishId} />
      <label htmlFor="name" className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
        Name
      </label>
      <input
        id="name"
        name="name"
        defaultValue={state?.values?.name ?? name}
        maxLength={80}
        required
        className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 font-display text-[19px] text-ink focus:border-paprika focus:outline-none"
      />

      <label htmlFor="note" className="mt-4 block text-[13px] font-medium tracking-wide text-ink-faint uppercase">
        Note
      </label>
      <input
        id="note"
        name="note"
        defaultValue={note ?? ""}
        maxLength={280}
        placeholder="Optional"
        className="mt-2 h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-paprika focus:outline-none"
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <Button type="submit" size="md" className="mt-4 w-full" disabled={pending}>
        {pending ? "Saving" : "Save changes"}
      </Button>
    </form>
  );
}
