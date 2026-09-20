"use client";

import { useActionState } from "react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import {
  renameHousehold,
  updateDisplayName,
  type FormState,
} from "@/lib/household-actions";

/** A row that reads as text until you focus it, then behaves like a field. */
const inlineInput =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-ink focus:border-paprika focus:outline-none";

export function RenameHouseholdForm({
  householdId,
  name,
}: {
  householdId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    renameHousehold,
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex gap-2">
      <input type="hidden" name="household_id" value={householdId} />
      <input
        aria-label="Household name"
        name="name"
        defaultValue={name}
        maxLength={60}
        className={inlineInput}
      />
      <Button type="submit" variant="secondary" size="md" disabled={pending}>
        Save
      </Button>
      {state?.error && <FormError>{state.error}</FormError>}
    </form>
  );
}

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateDisplayName,
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex gap-2">
      <input
        aria-label="Your name"
        name="display_name"
        defaultValue={displayName}
        maxLength={40}
        className={inlineInput}
      />
      <Button type="submit" variant="secondary" size="md" disabled={pending}>
        Save
      </Button>
      {state?.error && <FormError>{state.error}</FormError>}
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard blocked (insecure context, or the person said no).
          // The code is on screen anyway.
        }
      }}
      className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft"
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
