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
      await tx.signatureProfile.updateMany({
        where: { userId: user.id, status: SignatureProfileStatus.APPROVED },
        data: { status: SignatureProfileStatus.SUPERSEDED, reviewedAt: new Date(), reviewReason: "Superseded by the staff member's authenticated replacement signature." },
      });
      await tx.signatureProfile.create({
        data: {
          userId: user.id,
          version: (latest._max.version ?? 0) + 1,
          imageBytes: bytes,
          mimeType: "image/png",
          sizeBytes: validated.sizeBytes,
          sha256: validated.sha256,
          status: SignatureProfileStatus.APPROVED,
          attestation: SIGNATURE_PROFILE_ATTESTATION,
          reviewedAt: new Date(),
          reviewReason: "Activated by authenticated staff self-submission.",
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
