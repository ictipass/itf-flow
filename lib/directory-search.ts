export type DirectorySearchMode = "action" | "copy";

export function directoryRecipientScope(input: {
  mode: DirectorySearchMode;
  currentUserId: string;
  permittedActionIds: string[] | null;
}) {
  if (input.mode === "copy" || input.permittedActionIds === null) {
    return { id: { not: input.currentUserId } };
  }
  return { id: { in: input.permittedActionIds, not: input.currentUserId } };
}
