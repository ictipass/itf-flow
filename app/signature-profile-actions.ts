"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignatureProfileStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertSignatureImageDecodable, SIGNATURE_PROFILE_ATTESTATION, validateSignatureImage } from "@/lib/signature-profile";

function profileRedirect(code: string): never {
  redirect(`/profile/signature?result=${encodeURIComponent(code)}`);
}

export async function submitSignatureProfileAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("signatureImage");
  if (!(file instanceof File) || !file.size) profileRedirect("missing-file");
  if (formData.get("confirmOwnership") !== "CONFIRM") profileRedirect("attestation");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const validated = validateSignatureImage(bytes, file.type);
    await assertSignatureImageDecodable(bytes);
    await db.$transaction(async (tx) => {
      const latest = await tx.signatureProfile.aggregate({ where: { userId: user.id }, _max: { version: true } });
      await tx.signatureProfile.create({
        data: {
          userId: user.id,
          version: (latest._max.version ?? 0) + 1,
          imageBytes: bytes,
          mimeType: "image/png",
          sizeBytes: validated.sizeBytes,
          sha256: validated.sha256,
          status: SignatureProfileStatus.PENDING_REVIEW,
          attestation: SIGNATURE_PROFILE_ATTESTATION,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PNG") || message.includes("dimensions")) profileRedirect("invalid-image");
    throw error;
  }
  revalidatePath("/profile/signature");
  revalidatePath("/admin/signatures");
  profileRedirect("submitted");
}

export async function reviewSignatureProfileAction(formData: FormData) {
  const administrator = await requireUser();
  if (administrator.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const parsed = z.object({
    profileId: z.string().min(1),
    version: z.coerce.number().int().positive(),
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().min(10).max(500),
  }).safeParse({
    profileId: formData.get("profileId"),
    version: formData.get("version"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/admin/signatures?result=validation");
  const result = await db.$transaction(async (tx) => {
    const profile = await tx.signatureProfile.findUnique({ where: { id: parsed.data.profileId } });
    if (!profile || profile.version !== parsed.data.version || profile.status !== SignatureProfileStatus.PENDING_REVIEW) return "stale" as const;
    const latestForUser = await tx.signatureProfile.aggregate({ where: { userId: profile.userId }, _max: { version: true } });
    if (profile.version !== latestForUser._max.version) return "stale" as const;
    if (parsed.data.decision === "APPROVE") {
      await tx.signatureProfile.updateMany({
        where: { userId: profile.userId, status: SignatureProfileStatus.APPROVED },
        data: { status: SignatureProfileStatus.SUPERSEDED, reviewedAt: new Date(), reviewedById: administrator.id, reviewReason: "Superseded by an approved replacement signature profile." },
      });
    }
    await tx.signatureProfile.update({
      where: { id: profile.id },
      data: {
        status: parsed.data.decision === "APPROVE" ? SignatureProfileStatus.APPROVED : SignatureProfileStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: administrator.id,
        reviewReason: parsed.data.reason,
      },
    });
    return "updated" as const;
  });
  revalidatePath("/admin/signatures");
  revalidatePath("/profile/signature");
  redirect(`/admin/signatures?result=${result}`);
}

export async function revokeSignatureProfileAction(formData: FormData) {
  const administrator = await requireUser();
  if (administrator.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const parsed = z.object({
    profileId: z.string().min(1),
    version: z.coerce.number().int().positive(),
    reason: z.string().trim().min(10).max(500),
  }).safeParse({ profileId: formData.get("profileId"), version: formData.get("version"), reason: formData.get("reason") });
  if (!parsed.success) redirect("/admin/signatures?result=validation");
  const updated = await db.signatureProfile.updateMany({
    where: { id: parsed.data.profileId, version: parsed.data.version, status: SignatureProfileStatus.APPROVED },
    data: { status: SignatureProfileStatus.REVOKED, reviewedAt: new Date(), reviewedById: administrator.id, reviewReason: parsed.data.reason },
  });
  revalidatePath("/admin/signatures");
  revalidatePath("/profile/signature");
  redirect(`/admin/signatures?result=${updated.count === 1 ? "revoked" : "stale"}`);
}
