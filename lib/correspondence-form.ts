export type WorkflowCategoryOption = {
  code: string;
  name: string;
  correspondenceType: string;
  routineSlaDays: number;
  urgentSlaDays: number;
  immediateSlaDays: number;
};

export function categoriesForDocumentType(
  categories: WorkflowCategoryOption[],
  documentType: string,
) {
  return categories.filter((category) => category.correspondenceType === documentType);
}

export const routingPurposeHelp: Record<string, string> = {
  ACTION: "The recipient becomes accountable for treating or progressing the matter.",
  REVIEW: "The recipient examines the matter and records a recommendation; this is not final approval.",
  CONCURRENCE: "The recipient formally agrees, objects, or returns the matter before it proceeds; concurrence is not final approval.",
  APPROVAL: "The authorized recipient makes the formal approval decision for the current immutable revision.",
};
