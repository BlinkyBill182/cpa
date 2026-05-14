"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { toggleActionAction } from "./actions";

type ActionEnableToggleProps = {
  lang: string;
  tenantId: string;
  actionKey: string;
  initialEnabled: boolean;
  labelAllowed: string;
  labelNotAllowed: string;
};

export const ActionEnableToggle = ({
  lang,
  tenantId,
  actionKey,
  initialEnabled,
  labelAllowed,
  labelNotAllowed,
}: ActionEnableToggleProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [on, setOn] = useState(initialEnabled);

  useEffect(() => {
    setOn(initialEnabled);
  }, [initialEnabled]);

  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <span
        className={`text-sm font-medium tabular-nums ${on ? "text-slate-400" : "text-slate-900 dark:text-slate-200"}`}
      >
        {labelNotAllowed}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          aria-label={on ? labelAllowed : labelNotAllowed}
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
          className="pointer-events-none absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2 dark:bg-slate-600 dark:peer-checked:bg-blue-500"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[1.25rem] dark:bg-slate-100"
          aria-hidden
        />
      </span>
      <span
        className={`text-sm font-medium tabular-nums ${on ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}`}
      >
        {labelAllowed}
      </span>
    </label>
  );
};
