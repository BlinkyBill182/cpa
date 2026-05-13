import type { ActionDefinition } from "@/lib/actions/types";

/**
 * Office-specific example: only available to offices explicitly listed in
 * `officeSpecific`. In production, replace the slug array with the actual
 * office slugs that have licensed this action.
 */
export const clientReport: ActionDefinition = {
  key: "client-report",
  icon: "📁",
  dictNamespace: "clientReport",
  officeSpecific: ["demo-cpa"],
};
