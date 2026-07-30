export type MailConfiguration = {
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  folder: string;
  maximumMessageBytes: number;
};

function enabled(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function getMailConfiguration(): MailConfiguration {
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;
  if (!username || !password) {
    throw new Error("MAIL_USERNAME and MAIL_PASSWORD must be configured.");
  }
  return {
    username,
    password,
    imapHost: process.env.MAIL_IMAP_HOST ?? "mail.itf.gov.ng",
    imapPort: Number(process.env.MAIL_IMAP_PORT ?? "993"),
    imapSecure: enabled(process.env.MAIL_IMAP_SECURE, true),
    smtpHost: process.env.MAIL_SMTP_HOST ?? "mail.itf.gov.ng",
    smtpPort: Number(process.env.MAIL_SMTP_PORT ?? "465"),
    smtpSecure: enabled(process.env.MAIL_SMTP_SECURE, true),
    folder: process.env.MAIL_IMAP_FOLDER ?? "INBOX",
    maximumMessageBytes: Number(process.env.MAIL_MAX_MESSAGE_SIZE_MB ?? "50") * 1024 * 1024,
  };
}

export function isMailEnabled() {
  return enabled(process.env.MAIL_ENABLED, false);
}
