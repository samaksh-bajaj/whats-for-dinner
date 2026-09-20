"use client";

import { useActionState } from "react";
import { ArrowLeft, LoaderCircle, MailCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type MagicLinkState } from "@/lib/auth-actions";

export function LoginForm({
  next,
  linkFailed,
}: {
  next: string;
  linkFailed: boolean;
}) {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div className="mt-10">
        <MailCheck size={28} className="text-olive" aria-hidden />
        <h2 className="mt-5 font-display text-[28px] leading-tight font-semibold text-ink">
          Check your inbox
        </h2>
        <p className="mt-3 max-w-[34ch] text-[16px] leading-relaxed text-ink-soft">
          We sent a sign-in link to{" "}
          <span className="text-ink">{state.email}</span>. It opens in this
          browser and lasts an hour.
        </p>
        <form action={formAction} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={state.email} />
          <Button type="submit" variant="quiet" size="sm" disabled={pending}>
            {pending ? "Sending" : "Send it again"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 flex flex-1 flex-col">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="email" className="text-[14px] font-medium text-ink-soft">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        placeholder="you@example.com"
        className="mt-2 h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-[17px] text-ink placeholder:text-ink-faint focus:border-paprika focus:outline-none"
      />

      {(state.status === "error" || linkFailed) && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-[14px] text-paprika"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {state.status === "error"
            ? state.message
            : "That link has expired or was already used. Here's a fresh one."}
        </p>
      )}

      <div className="mt-auto pt-10">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && (
            <LoaderCircle size={18} className="animate-spin" aria-hidden />
          )}
          {pending ? "Sending" : "Email me a link"}
        </Button>
        <p className="mt-4 text-center text-[14px] text-ink-faint">
          No password. The link signs you in on this device.
        </p>
      </div>
    </form>
  );
}

export function BackToStart() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-1.5 text-[14px] text-ink-faint hover:text-ink-soft"
    >
      <ArrowLeft size={15} aria-hidden />
      Back
    </a>
  );
}
