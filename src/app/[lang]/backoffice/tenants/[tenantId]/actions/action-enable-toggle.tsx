"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { toggleActionAction } from "./actions";

type ActionEnableToggleProps = {
  lang: string;
  tenantId: string;
  actionKey: string;
  initialEnabled: boolean;
  /** Element id of the visible action title (for aria-labelledby). */
  labelId: string;
};

export const ActionEnableToggle = ({
  lang,
  tenantId,
  actionKey,
  initialEnabled,
  labelId,
}: ActionEnableToggleProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [on, setOn] = useState(initialEnabled);
  const switchId = `${labelId}-switch`;

  useEffect(() => {
    setOn(initialEnabled);
  }, [initialEnabled]);

  return (
    <label
      htmlFor={switchId}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center ${isPending ? "opacity-60" : ""}`}
    >
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        checked={on}
        disabled={isPending}
        className="peer sr-only"
        onChange={(e) => {
          const checked = e.target.checked;
          setOn(checked);
          startTransition(async () => {
            const fd = new FormData();
            fd.set("actionKey", actionKey);
            fd.set("isEnabled", checked ? "true" : "false");
            await toggleActionAction(lang, tenantId, fd);
            router.refresh();
          });
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 peer-focus-within:ring-2 peer-focus-within:ring-blue-400 peer-focus-within:ring-offset-2 dark:bg-slate-600 dark:peer-checked:bg-blue-500"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[1.25rem] dark:bg-slate-100"
        aria-hidden
      />
    </label>
  );
};
