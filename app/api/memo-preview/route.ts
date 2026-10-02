import { randomUUID } from "crypto";
import { CorrespondenceType, SignatureProfileStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { itfLogoPng } from "@/lib/itf-branding";
import { renderMemoOutput } from "@/lib/memo-output";
import { normalizeRichTextForStorage, richTextPlainText } from "@/lib/rich-text";
import { getCurrentUser } from "@/lib/session";

function text(formData: FormData, name: string, maximum = 5000) {
  return String(formData.get(name) ?? "").trim().slice(0, maximum);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to preview a memo.", { status: 401 });
  try {
    const formData = await request.formData();
    if (text(formData, "type", 40) !== CorrespondenceType.INTERNAL_MEMO) {
      return new Response("Preview is currently available for internal memos.", { status: 400 });
    }
    const subject = text(formData, "subject", 300);
    const summary = text(formData, "summary", 4000);
    const body = normalizeRichTextForStorage(formData.get("body"));
    if (subject.length < 5 || summary.length < 10 || !richTextPlainText(body)) {
      return new Response("Enter the subject, summary and memo body before previewing.", { status: 400 });
    }
    const recipientId = text(formData, "ultimateRecipientUserId", 100);
    const recipient = recipientId ? await db.user.findFirst({ where: { id: recipientId, isActive: true } }) : null;
    if (!recipient) return new Response("Select the ultimate recipient before previewing.", { status: 400 });
    const signature = await db.signatureProfile.findFirst({
      where: { userId: user.id, status: SignatureProfileStatus.APPROVED },
      orderBy: { version: "desc" },
    });
    const generatedAt = new Date();
    const bytes = await renderMemoOutput({
      outputId: `PREVIEW-${randomUUID()}`,
      referenceNumber: "DRAFT-PREVIEW",
      classification: text(formData, "classification", 30) || "INTERNAL",
      priority: text(formData, "priority", 30) || "ROUTINE",
      status: "DRAFT",
      subject,
      summary,
      body: body ?? null,
      senderReference: text(formData, "senderReference", 200) || null,
      memoDate: generatedAt,
      revisionVersion: 0,
      originator: { name: user.name, position: user.position, office: user.office, department: user.department },
      routingNames: [`${recipient.name}${recipient.position ? ` (${recipient.position})` : ""}`],
      generatedBy: user.name,
      generatedAt,
      signaturePng: signature ? Buffer.from(signature.imageBytes) : null,
      signatureProfileVersion: signature?.version ?? 0,
      signatureSha256: signature?.sha256 ?? "NO-ACTIVE-SIGNATURE",
      events: [],
      attachments: [],
      decisions: [],
      logoPng: await itfLogoPng(),
      includeLifecycleEvidence: false,
      draftPreview: true,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=ITF-memo-draft-preview.pdf",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Memo preview generation failed.", error);
    return new Response("Memo preview could not be generated. Review the memo fields and try again.", { status: 400 });
  }
}
