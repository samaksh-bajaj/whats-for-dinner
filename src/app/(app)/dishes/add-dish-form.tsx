"use client";

import { useActionState, useRef, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { addDish, type DishFormState } from "@/lib/dish-actions";

export function AddDishForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<DishFormState, FormData>(
    async (previous, formData) => {
      const result = await addDish(previous, formData);
      // A null result is a clean insert; React has already reset the fields.
      if (!result) formRef.current?.querySelector("input")?.focus();
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus size={17} aria-hidden />
        Add a dish
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          New dish
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-ink-faint hover:text-ink-soft"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <input
        name="name"
        aria-label="Dish name"
        placeholder="Rajma chawal"
        defaultValue={state?.values?.name ?? ""}
        maxLength={80}
        required
        autoFocus
        className="mt-3 h-12 w-full rounded-lg border border-line bg-ground px-3 font-display text-[19px] text-ink placeholder:font-sans placeholder:text-[16px] placeholder:text-ink-faint focus:border-paprika focus:outline-none"
      />
      <input
        name="note"
        aria-label="Note"
        placeholder="Anything worth remembering — takes an hour, needs soaking"
        maxLength={280}
        className="mt-2 h-11 w-full rounded-lg border border-line bg-ground px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-paprika focus:outline-none"
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <Button type="submit" size="md" className="mt-4 w-full" disabled={pending}>
        {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
        {pending ? "Adding" : "Add to the list"}
      </Button>
    </form>
  );
}
