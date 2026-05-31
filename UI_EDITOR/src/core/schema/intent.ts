export interface IntentAnnotations {
  name?: string;
  intent?: string;
  behaviour?: string;
  dataBinding?: string;
  dependsOn?: string[];
  authorNotes?: string;
}

export type LibraryIntentAnnotations = Pick<
  IntentAnnotations,
  "name" | "intent" | "behaviour" | "dataBinding"
>;
