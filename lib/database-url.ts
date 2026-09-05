export type PrismaPostgresConnectionKind = "pooled" | "direct" | "other" | "invalid";

export function isPostgresConnectionUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function prismaPostgresConnectionKind(
  value: string | undefined
): PrismaPostgresConnectionKind {
  if (!isPostgresConnectionUrl(value)) return "invalid";

  const hostname = new URL(value!).hostname.toLowerCase();
  if (hostname === "pooled.db.prisma.io") return "pooled";
  if (hostname === "db.prisma.io") return "direct";
  return "other";
}

function requirePostgresUrl(value: string | undefined, variableName: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${variableName} is required.`);
  if (!isPostgresConnectionUrl(normalized)) {
    throw new Error(
      `${variableName} must use a valid postgres:// or postgresql:// connection URL.`
    );
  }
  return normalized;
}

export function resolveMigrationDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>
): string {
  const directUrl = environment.DIRECT_URL?.trim();
  return directUrl
    ? requirePostgresUrl(directUrl, "DIRECT_URL")
    : requirePostgresUrl(environment.DATABASE_URL, "DATABASE_URL");
}
