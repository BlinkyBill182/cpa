import { annualIncomeSummary } from "./definitions/annual-income-summary/definition";
import { clientReport } from "./definitions/client-report/definition";
import { documentRequest } from "./definitions/document-request/definition";
import { taxReminder } from "./definitions/tax-reminder/definition";
import type { ActionDefinition } from "./types";

const actions: ActionDefinition[] = [
  annualIncomeSummary,
  documentRequest,
  taxReminder,
  clientReport,
];

/** All registered actions, regardless of office scope. */
export const getAllActions = (): ActionDefinition[] => actions;

/** Look up a single action by its key. */
export const getAction = (key: string): ActionDefinition | undefined =>
  actions.find((a) => a.key === key);

/**
 * Returns actions that are available to a given office slug.
 * Global actions (no officeSpecific list) are always included.
 * Office-specific actions are only included when the slug matches.
 */
export const getActionsForTenant = (slug: string): ActionDefinition[] =>
  actions.filter((a) => !a.officeSpecific?.length || a.officeSpecific.includes(slug));
