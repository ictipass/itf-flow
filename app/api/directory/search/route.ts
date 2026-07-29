import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPermittedActionRecipientIds } from "@/lib/reporting-lines";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const mode = url.searchParams.get("mode") === "copy" ? "copy" : "action";
  if (query.length < 2) return NextResponse.json({ people: [] });

  const permittedActionIds =
    mode === "action"
      ? await getPermittedActionRecipientIds(user.id, user.role)
      : null;
  const people = await db.user.findMany({
    where: {
      isActive: true,
      id: { not: user.id },
      ...(mode === "action" && permittedActionIds !== null
        ? { id: { in: permittedActionIds, not: user.id } }
        : {}),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { staffNumber: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
        { division: { contains: query, mode: "insensitive" } },
        { unit: { contains: query, mode: "insensitive" } },
        { office: { contains: query, mode: "insensitive" } },
        { position: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      staffNumber: true,
      department: true,
      division: true,
      unit: true,
      office: true,
      position: true,
      role: true,
    },
  });

  return NextResponse.json(
    { people },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
