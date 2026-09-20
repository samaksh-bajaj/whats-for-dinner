"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * True only once the browser has taken over. The server and the browser can
 * ship different ICU data, and a mismatched <option> list is a hydration
 * error, so the full list is rendered client-side.
 */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Which calendar day a round belongs to, and nothing else — so the phone's own
 * zone is almost always right. The select is uncontrolled: the `key` flip on
 * hydration re-mounts it with the detected zone as its default, and whatever
 * the person picks after that is simply what the form submits.
 */
export function TimezoneField({ id = "timezone" }: { id?: string }) {
  const hydrated = useHydrated();
  const detected = hydrated
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
    : "UTC";
  const zones = hydrated ? (Intl.supportedValuesOf?.("timeZone") ?? [detected]) : [detected];

  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-medium text-ink-soft">
        Timezone
      </label>
      <select
        key={hydrated ? "browser" : "server"}
        id={id}
        name="timezone"
        defaultValue={detected}
        className="mt-2 h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-[17px] text-ink focus:border-paprika focus:outline-none"
      >
        {zones.map((name) => (
          <option key={name} value={name}>
            {name.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[13px] text-ink-faint">
        Only used to decide which day a round counts as.
      </p>
    </div>
  );
}
