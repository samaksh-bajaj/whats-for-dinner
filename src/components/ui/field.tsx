import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

/** The one text input in the app: 52px, warm surface, paprika focus ring. */
export function Field({
  label,
  hint,
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  inputClassName?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={props.id} className="text-[14px] font-medium text-ink-soft">
        {label}
      </label>
      <input
        {...props}
        className={cn(
          "mt-2 h-[52px] w-full rounded-xl border border-line bg-surface px-4",
          "text-[17px] text-ink placeholder:text-ink-faint",
          "focus:border-paprika focus:outline-none",
          inputClassName,
        )}
      />
      {hint && <p className="mt-2 text-[13px] text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Inline form error, shared by every form that talks to an RPC. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-[14px] text-paprika">
      {children}
    </p>
  );
}
