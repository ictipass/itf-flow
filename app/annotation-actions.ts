"use server";

import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ActorType,
  DecisionOutcome,
  DocumentAnnotationPlacement,
  DocumentEventType,
  EventType,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { annotateDocument, isAnnotatableDocument } from "@/lib/document-annotation";
import { attachmentPassesDocumentSecurityGate } from "@/lib/document-security";
import { readStoredDocument, storeGeneratedPdf } from "@/lib/document-storage";
import { authorityMetadata, workAuthority } from "@/lib/delegations";
import { canMinute } from "@/lib/permissions";
import { captureRevision } from "@/lib/revisions";
import { APPROVAL_SIGNATURE_ALGORITHM, APPROVAL_SIGNATURE_KEY_ID, signApprovalPayload } from "@/lib/approval-signatures";
import { hasActiveEnterpriseMfa, requireUser } from "@/lib/session";
import { annotationAuthenticationPolicyFor } from "@/lib/annotation-policy";

const annotationSchema = z.object({
  attachmentId: z.string().min(1),
  pageNumber: z.coerce.number().int().min(1).max(10_000),
  placement: z.enum(DocumentAnnotationPlacement),
  minuteText: z.string().trim().min(3).max(1_500),
  confirmSignature: z.literal("CONFIRM"),
});

function annotatedName(originalName: string, version: number) {
  const stem = originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140) || "document";
  return `${stem}-annotated-v${version}.pdf`;
}

export async function annotateAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = annotationSchema.parse({
    attachmentId: formData.get("attachmentId"),
    pageNumber: formData.get("pageNumber"),
    placement: formData.get("placement"),
    minuteText: formData.get("minuteText"),
    confirmSignature: formData.get("confirmSignature"),
  });
  const source = await db.attachment.findFirst({
    where: { id: parsed.attachmentId, isIncluded: true },
    include: { correspondence: true },
  });
  if (!source || !attachmentPassesDocumentSecurityGate(source)) {
    throw new Error("The current document is unavailable or has not passed its security gate.");
  }
  if (!isAnnotatableDocument(source.mimeType)) {
    throw new Error("Only PDF, JPEG and PNG documents can be annotated in this slice.");
  }
  const authority = await workAuthority({ correspondenceId: source.correspondenceId, actor: user });
  if (!authority || !canMinute(authority.principal.role)) {
    throw new Error("Only the current action holder or an authorized delegate can minute and sign this document.");
  }

  const authenticationPolicy = await annotationAuthenticationPolicyFor(authority.principal.role);
  let authenticationMethod = "ADMIN_POLICY_RELAXED";
  if (authenticationPolicy.required) {
    const enterpriseMfa = await hasActiveEnterpriseMfa();
    authenticationMethod = "RECENT_ENTERPRISE_MFA";
    if (!enterpriseMfa) {
      const password = String(formData.get("signaturePassword") ?? "");
      if (!user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) {
        throw new Error("Strong re-authentication failed; the document was not annotated.");
      }
      authenticationMethod = "PASSWORD_RECONFIRMATION";
    }
  }

  const annotationVersion = (await db.documentAnnotation.aggregate({
    where: { correspondenceId: source.correspondenceId },
    _max: { version: true },
  }))._max.version ?? 0;
  const nextAnnotationVersion = annotationVersion + 1;
  const signedAt = new Date();
  const sourceBytes = await readStoredDocument(source.storageKey, source.storageProvider);
  if (createHash("sha256").update(sourceBytes).digest("hex") !== source.sha256) {
    throw new Error("The stored source document no longer matches its immutable hash; annotation is blocked.");
  }
  const rendered = await annotateDocument({
    source: sourceBytes,
    mimeType: source.mimeType,
    pageNumber: parsed.pageNumber,
    placement: parsed.placement,
    minuteText: parsed.minuteText,
    signerName: user.name,
    signerRole: authority.principal.role,
    signerPosition: user.position,
    authorityPrincipalName: authority.delegation ? authority.principal.name : null,
    signedAt,
  });
  const stored = await storeGeneratedPdf({
    correspondenceId: source.correspondenceId,
    originalName: annotatedName(source.originalName, nextAnnotationVersion),
    bytes: rendered.bytes,
    sourceMalwareScanStatus: source.malwareScanStatus === "CLEAN" ? "CLEAN" : "BYPASSED",
  });

  const result = await db.$transaction(async (tx) => {
    const replaced = await tx.attachment.updateMany({
      where: { id: source.id, correspondenceId: source.correspondenceId, isIncluded: true, sha256: source.sha256 },
      data: { isIncluded: false },
    });
    if (replaced.count !== 1) throw new Error("The document changed while it was being annotated. Reload and try again.");
    const output = await tx.attachment.create({
      data: {
        correspondenceId: source.correspondenceId,
        ...stored,
        documentEvents: {
          create: {
            type: DocumentEventType.ANNOTATED,
            detail: "Generated from an available source document with an authenticated minute and signing block.",
            metadata: { sourceAttachmentId: source.id, sourceSha256: source.sha256, pageNumber: parsed.pageNumber, placement: parsed.placement },
          },
        },
      },
    });
    const revision = await captureRevision(
      tx,
      source.correspondenceId,
      user.id,
      `Document annotation ${nextAnnotationVersion}: ${parsed.minuteText}`,
    );
    const payload = {
      schema: "ITF_FLOW_DOCUMENT_ANNOTATION_V1",
      correspondenceId: source.correspondenceId,
      sourceAttachmentId: source.id,
      outputAttachmentId: output.id,
      annotationVersion: nextAnnotationVersion,
      revisionId: revision.id,
      revisionVersion: revision.version,
      pageNumber: parsed.pageNumber,
      placement: parsed.placement,
      minuteText: parsed.minuteText,
      sourceSha256: source.sha256,
      outputSha256: stored.sha256,
      signerId: user.id,
      signerName: user.name,
      signerRole: authority.principal.role,
      signerPosition: user.position ?? null,
      authorityPrincipalId: authority.delegation ? authority.principal.id : null,
      authorityPrincipalName: authority.delegation ? authority.principal.name : null,
      delegationId: authority.delegation?.id ?? null,
      authenticationMethod,
      authenticationPolicyVersion: authenticationPolicy.configurationVersion,
      signedAt: signedAt.toISOString(),
      algorithm: APPROVAL_SIGNATURE_ALGORITHM,
      keyId: APPROVAL_SIGNATURE_KEY_ID,
    };
    await tx.documentAnnotation.create({
      data: {
        correspondenceId: source.correspondenceId,
        sourceAttachmentId: source.id,
        outputAttachmentId: output.id,
        version: nextAnnotationVersion,
        revisionId: revision.id,
        revisionVersion: revision.version,
        pageNumber: parsed.pageNumber,
        placement: parsed.placement,
        minuteText: parsed.minuteText,
        signerId: user.id,
        signerName: user.name,
        signerRole: authority.principal.role,
        signerPosition: user.position,
        authorityPrincipalId: authority.delegation ? authority.principal.id : null,
        authorityPrincipalName: authority.delegation ? authority.principal.name : null,
        delegationId: authority.delegation?.id,
        authenticationMethod,
        sourceSha256: source.sha256,
        outputSha256: stored.sha256,
        canonicalPayload: payload,
        signatureValue: signApprovalPayload(payload),
        algorithm: APPROVAL_SIGNATURE_ALGORITHM,
        keyId: APPROVAL_SIGNATURE_KEY_ID,
        signedAt,
      },
    });
    await tx.decisionRequest.updateMany({
      where: {
        correspondenceId: source.correspondenceId,
        outcome: { in: [DecisionOutcome.RECOMMENDED, DecisionOutcome.CONCURRED, DecisionOutcome.APPROVED] },
        supersededAt: null,
      },
      data: { supersededAt: signedAt, supersededByVersion: revision.version },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: source.correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.REVISED,
        fromStatus: source.correspondence.status,
        toStatus: source.correspondence.status,
        minute: parsed.minuteText,
        metadata: {
          annotationVersion: nextAnnotationVersion,
          revisionVersion: revision.version,
          sourceAttachmentId: source.id,
          outputAttachmentId: output.id,
          pageNumber: parsed.pageNumber,
          placement: parsed.placement,
          authenticationMethod,
          authenticationPolicyVersion: authenticationPolicy.configurationVersion,
          ...authorityMetadata(authority),
        },
      },
    });
    return { correspondenceId: source.correspondenceId, revisionVersion: revision.version };
  });
  revalidatePath(`/correspondence/${result.correspondenceId}`);
  redirect(`/correspondence/${result.correspondenceId}?revision=${result.revisionVersion}`);
}
