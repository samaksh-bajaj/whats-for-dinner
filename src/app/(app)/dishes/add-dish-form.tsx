"use client";

import { useActionState, useRef, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { addDish, type AddDishFormState } from "@/lib/dish-actions";

export function AddDishForm() {
  const [open, setOpen] = useState(false);

  // Unmounting the panel on close throws away its action state, so reopening
  // starts clean instead of resurfacing the last error.
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

  return <NewDishesPanel onClose={() => setOpen(false)} />;
}

function NewDishesPanel({ onClose }: { onClose: () => void }) {
  const counter = useRef(0);
  const nextId = () => ++counter.current;

  // Rows carry identity, not value: the inputs stay uncontrolled, and stable
  // ids mean removing a middle row leaves its neighbours' text alone.
  const [rows, setRows] = useState<number[]>([0]);
  const [focusId, setFocusId] = useState<number | null>(0);

  const [state, formAction, pending] = useActionState<AddDishFormState, FormData>(
    async (previous, formData) => {
      const result = await addDish(previous, formData);
      if (!result) {
        onClose();
        return result;
      }
      // Remounting every row with a fresh id is what makes the echoed values
      // stick: a new input takes its defaultValue outright, whether or not
      // React's post-action form reset has already run.
      const names = result.values?.names ?? [""];
      const revived = names.map(() => nextId());
      setRows(revived);
      setFocusId(revived[0] ?? null);
      return result;
    },
    null,
  );

  const addRow = () => {
    const id = nextId();
    setRows((current) => [...current, id]);
    setFocusId(id);
  };

  return (
    <form action={formAction} className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          {rows.length === 1 ? "New dish" : "New dishes"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-ink-faint hover:text-ink-soft"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((id, index) => (
          <li key={id} className="flex items-center gap-2">
            <input
              name="name"
              aria-label={`Dish ${index + 1}`}
              placeholder={index === 0 ? "Rajma chawal" : "And another"}
              defaultValue={state?.values?.names?.[index] ?? ""}
              maxLength={80}
              autoFocus={id === focusId}
              className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 font-display text-[19px] text-ink placeholder:font-sans placeholder:text-[16px] placeholder:text-ink-faint focus:border-paprika focus:outline-none"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((row) => row !== id))}
                aria-label={`Remove dish ${index + 1}`}
                className="shrink-0 p-2 text-ink-faint hover:text-ink-soft"
              >
                <X size={17} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="quiet"
        size="sm"
        onClick={addRow}
        aria-label="Add another dish"
        className="mt-2"
      >
        <Plus size={16} aria-hidden />
        Add another
      </Button>

      {state?.error && <FormError>{state.error}</FormError>}

      <Button type="submit" size="md" className="mt-4 w-full" disabled={pending}>
        {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
        {pending ? "Adding" : "Add to the list"}
      </Button>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
        Notes come later &mdash; tap a dish to say what is worth remembering
        about it.
      </p>
    </form>
  );
}
