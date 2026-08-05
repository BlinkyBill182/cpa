"use client";

import { useActionState } from "react";

import type { RecheckResult } from "./actions";

interface Labels {
  recheck: string;
  checking: string;
  recheckTitle: string;
}

interface Props {
  action: (prev: RecheckResult, formData: FormData) => Promise<RecheckResult>;
  fileId: string;
  clientYearId: string;
  clientId: string;
  year: number;
  labels: Labels;
}

export function RecheckForm({ action, fileId, clientYearId, clientId, year, labels }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="file_id" value={fileId} />
        <input type="hidden" name="client_year_id" value={clientYearId} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="year" value={year} />
        <button
          type="submit"
          disabled={isPending}
          title={labels.recheckTitle}
          className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
            isPending
              ? "cursor-wait bg-amber-50 text-amber-400 dark:bg-amber-900/10 dark:text-amber-400"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          {isPending ? (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              {labels.checking}
            </span>
          ) : (
            labels.recheck
          )}
        </button>
      </form>

      {/* Inline result shown immediately after action completes */}
      {state && !isPending && (
        <div
          className={`max-w-[180px] rounded px-2 py-1 text-xs ${
            state.status === "error" || (state.status === "ok" && state.aiStatus === "invalid")
              ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
          }`}
        >
          {state.status === "error" ? (
            <>⚠ {state.message}</>
          ) : state.aiStatus === "valid" ? (
            <>✓ מסמך תקין</>
          ) : (
            <>⚠ {state.notes ?? "מסמך לא תקין"}</>
          )}
        </div>
      )}
    </div>
  );
}
