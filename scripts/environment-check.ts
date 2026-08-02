import "dotenv/config";
import { access } from "fs/promises";
import path from "path";
import { db } from "../lib/db";

const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "WORKSPACE_LAUNCH_TOKEN_SECRET",
  "WORKSPACE_DIRECTORY_SYNC_SECRET",
  "NEXT_PUBLIC_WORKSPACE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) errors.push(`Node.js ${process.versions.node} is unsupported; install Node.js 20.9 or newer.`);

  for (const name of required) if (!process.env[name]?.trim()) errors.push(`${name} is missing.`);
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) errors.push("SESSION_SECRET must contain at least 32 characters.");
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgresql://")) errors.push("DATABASE_URL must be a PostgreSQL connection URL.");

  if (process.env.MAIL_ENABLED === "true") {
    for (const name of ["MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_IMAP_HOST", "MAIL_SMTP_HOST"] as const) {
      if (!process.env[name]?.trim()) errors.push(`${name} is required when MAIL_ENABLED=true.`);
    }
  } else {
    warnings.push("Mailbox integration is disabled (MAIL_ENABLED is not true). This is acceptable for local UI development.");
  }

  try {
    await db.$queryRaw`SELECT 1`;
    const [users, migrations] = await Promise.all([
      db.user.count(),
      db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`,
    ]);
    console.log(`✓ PostgreSQL reachable · ${users} users · ${migrations[0]?.count ?? 0n} applied migrations`);
  } catch {
    errors.push("PostgreSQL is unreachable or has not been migrated. Check DATABASE_URL and run npm run db:migrate.");
  }

  try {
    await access(path.resolve(process.cwd(), "storage", "uploads"));
    console.log("✓ Local upload directory is present");
  } catch {
    warnings.push("storage/uploads is absent. It will be created on first upload; restore it separately if existing documents are required.");
  }

  for (const warning of warnings) console.warn(`⚠ ${warning}`);
  for (const error of errors) console.error(`✗ ${error}`);
  if (errors.length) process.exitCode = 1;
  else console.log("✓ ITF Flow environment is ready");
}

main().finally(() => db.$disconnect());
