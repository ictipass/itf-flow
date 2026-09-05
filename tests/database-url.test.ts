import assert from "node:assert/strict";
import test from "node:test";
import {
  isPostgresConnectionUrl,
  prismaPostgresConnectionKind,
  resolveMigrationDatabaseUrl,
} from "../lib/database-url";

test("accepts both supported PostgreSQL URL schemes", () => {
  assert.equal(
    isPostgresConnectionUrl("postgres://user:secret@database.example.test:5432/app"),
    true
  );
  assert.equal(
    isPostgresConnectionUrl("postgresql://user:secret@database.example.test:5432/app"),
    true
  );
  assert.equal(isPostgresConnectionUrl("https://database.example.test/app"), false);
  assert.equal(isPostgresConnectionUrl("not-a-url"), false);
});

test("classifies Prisma Postgres pooled and direct endpoints", () => {
  assert.equal(
    prismaPostgresConnectionKind("postgres://user:secret@pooled.db.prisma.io:5432/postgres"),
    "pooled"
  );
  assert.equal(
    prismaPostgresConnectionKind("postgres://user:secret@db.prisma.io:5432/postgres"),
    "direct"
  );
  assert.equal(
    prismaPostgresConnectionKind("postgres://user:secret@localhost:5432/postgres"),
    "other"
  );
});

test("uses DIRECT_URL for migrations and falls back to DATABASE_URL", () => {
  const runtime = "postgres://runtime:secret@pooled.db.prisma.io:5432/postgres";
  const direct = "postgres://migration:secret@db.prisma.io:5432/postgres";

  assert.equal(resolveMigrationDatabaseUrl({ DATABASE_URL: runtime, DIRECT_URL: direct }), direct);
  assert.equal(resolveMigrationDatabaseUrl({ DATABASE_URL: runtime }), runtime);
  assert.throws(
    () => resolveMigrationDatabaseUrl({ DATABASE_URL: "https://invalid.example.test" }),
    /DATABASE_URL must use a valid postgres:\/\//
  );
});
