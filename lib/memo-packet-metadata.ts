export function metadataStringArray(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const value = (metadata as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function memoPacketIncludedAttachmentIds(events: { metadata: unknown }[]) {
  return events.map((event) => metadataStringArray(event.metadata, "includedAttachmentIds")).find((ids) => ids.length) ?? [];
}
