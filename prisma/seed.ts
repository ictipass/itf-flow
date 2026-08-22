import "dotenv/config";
import bcrypt from "bcryptjs";
import { BroadcastCategory, BroadcastScopeType, UserRole } from "../lib/generated/prisma/client";
import { db } from "../lib/db";

const demoUsers = [
  { staffNumber: "ITF/SYS/001", email: "admin@itf.gov.ng", name: "ITF Flow Administrator", role: UserRole.SYSTEM_ADMIN, office: "ITF Digital Services", position: "System Administrator", hierarchyLevel: 6 },
  { staffNumber: "ITF/DGS/001", email: "secretary.abuja@itf.gov.ng", name: "Amina Yusuf", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Abuja", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DGS/002", email: "secretary.jos@itf.gov.ng", name: "Grace Danladi", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Jos", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DGS/003", email: "secretary.lagos@itf.gov.ng", name: "Chioma Okeke", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Lagos", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DG/001", email: "dg@itf.gov.ng", name: "Director-General", role: UserRole.DG, office: "Director-General's Office", position: "Director-General", hierarchyLevel: 5 },
  { staffNumber: "ITF/HR/001", email: "director.hr@itf.gov.ng", name: "Director Human Resources", role: UserRole.DIRECTOR, office: "Headquarters", department: "Human Resources", position: "Director Human Resources", hierarchyLevel: 4 },
  { staffNumber: "ITF/ICT/001", email: "director.ict@itf.gov.ng", name: "Director ICT", role: UserRole.DIRECTOR, office: "Headquarters", department: "ICT", position: "Director ICT", hierarchyLevel: 4 },
  { staffNumber: "ITF/RIC/001", email: "director.ric@itf.gov.ng", name: "Director Revenue, Inspectorate and Compliance", role: UserRole.DIRECTOR, office: "Headquarters", department: "Revenue, Inspectorate and Compliance", position: "Director RIC", hierarchyLevel: 4 },
  { staffNumber: "ITF/SDO/001", email: "director.sdo@itf.gov.ng", name: "Director SDO", role: UserRole.DIRECTOR, office: "Headquarters", department: "Service Development and Operations", position: "Director SDO", hierarchyLevel: 4 },
  { staffNumber: "ITF/ICT/010", email: "head.pass@itf.gov.ng", name: "Head PASS Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "PASS", position: "Division Head", hierarchyLevel: 3 },
  { staffNumber: "ITF/ICT/011", email: "head.ncs@itf.gov.ng", name: "Head NCS Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "NCS", position: "Division Head", hierarchyLevel: 3 },
  { staffNumber: "ITF/ICT/012", email: "head.hardware@itf.gov.ng", name: "Head Hardware Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "Hardware", position: "Division Head", hierarchyLevel: 3 },
  { staffNumber: "ITF/ICT/020", email: "unit.apps@itf.gov.ng", name: "Head Applications Unit", role: UserRole.UNIT_HEAD, office: "Headquarters", department: "ICT", division: "PASS", unit: "Applications", position: "Unit Head", hierarchyLevel: 2 },
  { staffNumber: "ITF/ICT/030", email: "officer.apps@itf.gov.ng", name: "Applications Officer", role: UserRole.OFFICER, office: "Headquarters", department: "ICT", division: "PASS", unit: "Applications", position: "ICT Officer", hierarchyLevel: 1 },
];

const reportingLines: Record<string, string> = {
  "secretary.abuja@itf.gov.ng": "dg@itf.gov.ng",
  "secretary.jos@itf.gov.ng": "dg@itf.gov.ng",
  "secretary.lagos@itf.gov.ng": "dg@itf.gov.ng",
  "director.ict@itf.gov.ng": "dg@itf.gov.ng",
  "director.hr@itf.gov.ng": "dg@itf.gov.ng",
  "director.ric@itf.gov.ng": "dg@itf.gov.ng",
  "director.sdo@itf.gov.ng": "dg@itf.gov.ng",
  "head.pass@itf.gov.ng": "director.ict@itf.gov.ng",
  "head.ncs@itf.gov.ng": "director.ict@itf.gov.ng",
  "head.hardware@itf.gov.ng": "director.ict@itf.gov.ng",
  "unit.apps@itf.gov.ng": "head.pass@itf.gov.ng",
  "officer.apps@itf.gov.ng": "unit.apps@itf.gov.ng",
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is forbidden when NODE_ENV=production.");
  if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Set ALLOW_DEMO_SEED=true only in a disposable local/demo environment.");
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "Demo123!", 12);
  const userIds = new Map<string, string>();

  for (const user of demoUsers) {
    const saved = await db.user.upsert({
      where: { email: user.email },
      update: { ...user, passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
    userIds.set(saved.email, saved.id);
  }

  for (const [email, supervisorEmail] of Object.entries(reportingLines)) {
    const supervisorId = userIds.get(supervisorEmail);
    if (!supervisorId) throw new Error(`Missing seeded supervisor: ${supervisorEmail}`);
    await db.user.update({
      where: { email },
      data: { supervisorId },
    });
  }

  const allCategories = Object.values(BroadcastCategory);
  const grantSpecs = [
    { email: "dg@itf.gov.ng", scopeType: BroadcastScopeType.ORGANIZATION, scopeValue: null, allowedCategories: allCategories, canRequireAcknowledgement: true },
    { email: "admin@itf.gov.ng", scopeType: BroadcastScopeType.ORGANIZATION, scopeValue: null, allowedCategories: [BroadcastCategory.SYSTEM, BroadcastCategory.EMERGENCY], canRequireAcknowledgement: true },
    { email: "director.hr@itf.gov.ng", scopeType: BroadcastScopeType.ORGANIZATION, scopeValue: null, allowedCategories: [BroadcastCategory.HUMAN_RESOURCES, BroadcastCategory.POLICY, BroadcastCategory.GENERAL], canRequireAcknowledgement: true },
    { email: "director.ict@itf.gov.ng", scopeType: BroadcastScopeType.DEPARTMENT, scopeValue: "ICT", allowedCategories: [BroadcastCategory.GENERAL, BroadcastCategory.POLICY, BroadcastCategory.SYSTEM], canRequireAcknowledgement: true },
    { email: "director.ric@itf.gov.ng", scopeType: BroadcastScopeType.DEPARTMENT, scopeValue: "Revenue, Inspectorate and Compliance", allowedCategories: [BroadcastCategory.GENERAL, BroadcastCategory.POLICY], canRequireAcknowledgement: true },
    { email: "director.sdo@itf.gov.ng", scopeType: BroadcastScopeType.DEPARTMENT, scopeValue: "Service Development and Operations", allowedCategories: [BroadcastCategory.GENERAL, BroadcastCategory.POLICY], canRequireAcknowledgement: true },
    { email: "head.pass@itf.gov.ng", scopeType: BroadcastScopeType.DIVISION, scopeValue: "PASS", allowedCategories: [BroadcastCategory.GENERAL], canRequireAcknowledgement: false },
    { email: "head.ncs@itf.gov.ng", scopeType: BroadcastScopeType.DIVISION, scopeValue: "NCS", allowedCategories: [BroadcastCategory.GENERAL], canRequireAcknowledgement: false },
    { email: "head.hardware@itf.gov.ng", scopeType: BroadcastScopeType.DIVISION, scopeValue: "Hardware", allowedCategories: [BroadcastCategory.GENERAL], canRequireAcknowledgement: false },
  ];
  await db.broadcastPublisherGrant.deleteMany({ where: { userId: { in: grantSpecs.flatMap((grant) => userIds.get(grant.email) ? [userIds.get(grant.email)!] : []) } } });
  await db.broadcastPublisherGrant.createMany({ data: grantSpecs.map(({ email, ...grant }) => ({ ...grant, userId: userIds.get(email)! })) });

  console.log(`Seeded ${demoUsers.length} ITF Flow demo users, reporting lines, and ${grantSpecs.length} broadcast grants.`);
}

main().finally(() => db.$disconnect());
