export function createReferenceNumber(sequence: number, date = new Date()) {
  return `ITF/FLOW/${date.getFullYear()}/${String(sequence).padStart(5, "0")}`;
}

export function label(value: string) {
  const acronyms = new Set(["DG", "EDMS", "IMAP", "ITF", "MFA", "OCR", "PDF", "PKI", "PWA", "SHA", "SMTP"]);
  return value.split("_").map((word) => {
    const upper = word.toUpperCase();
    return acronyms.has(upper) ? upper : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  }).join(" ");
}
