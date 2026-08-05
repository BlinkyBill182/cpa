/**
 * The camelCase namespace under dict.actions for this action,
 * e.g. "annualIncomeSummary". Must match the key in en.json / he.json.
 */
export type ActionDictNamespace =
  | "annualIncomeSummary"
  | "documentRequest"
  | "taxReminder"
  | "clientReport";

export interface ActionDefinition {
  /** Unique slug used as DB key and URL segment, e.g. "annual-income-summary" */
  key: string;
  /** Emoji shown on the marketplace card */
  icon: string;
  /** Key under dict.actions containing { title, description } */
  dictNamespace: ActionDictNamespace;
  /**
   * "office" — action runs for all clients at once (e.g. annual income dashboard).
   * "client" — action is triggered per individual client.
   * Defaults to "client" when omitted.
   */
  scope?: "office" | "client";
  /**
   * If set, the action is only available to offices whose slug appears in this
   * list. Leave undefined (or empty) for actions available to all offices.
   */
  officeSpecific?: string[];
}
