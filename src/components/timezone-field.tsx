"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Which calendar day a round belongs to, and nothing else — so the phone's own
 * zone is almost always right. The list is built after mount: server and
 * browser can carry different ICU data, and a mismatched <option> list is a
 * hydration error for a field nobody will touch.
 */
export function TimezoneField({ id = "timezone" }: { id?: string }) {
  const [zone, setZone] = useState("UTC");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setZone(detected);
    setMounted(true);
  }, []);

  const zones = useMemo(() => {
    if (!mounted) return [zone];
    const all = Intl.supportedValuesOf?.("timeZone") ?? [];
    return all.includes(zone) ? all : [zone, ...all];
  }, [mounted, zone]);

  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-medium text-ink-soft">
        Timezone
      </label>
      <select
        id={id}
        name="timezone"
        value={zone}
        onChange={(event) => setZone(event.target.value)}
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
