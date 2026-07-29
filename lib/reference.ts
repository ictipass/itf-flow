export function createReferenceNumber(sequence: number, date = new Date()) {
  return `ITF/FLOW/${date.getFullYear()}/${String(sequence).padStart(5, "0")}`;
}

export function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
