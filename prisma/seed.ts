import "dotenv/config";
import bcrypt from "bcryptjs";
import { UserRole } from "../lib/generated/prisma/client";
import { db } from "../lib/db";

const demoUsers = [
  { staffNumber: "ITF/SYS/001", email: "admin@itf.gov.ng", name: "ITF Flow Administrator", role: UserRole.SYSTEM_ADMIN, office: "ITF Digital Services", position: "System Administrator", hierarchyLevel: 6 },
  { staffNumber: "ITF/DGS/001", email: "secretary.abuja@itf.gov.ng", name: "Amina Yusuf", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Abuja", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DGS/002", email: "secretary.jos@itf.gov.ng", name: "Grace Danladi", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Jos", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DGS/003", email: "secretary.lagos@itf.gov.ng", name: "Chioma Okeke", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Lagos", position: "DG Secretary", hierarchyLevel: 4 },
  { staffNumber: "ITF/DG/001", email: "dg@itf.gov.ng", name: "Director-General", role: UserRole.DG, office: "Director-General's Office", position: "Director-General", hierarchyLevel: 5 },
  { staffNumber: "ITF/ICT/001", email: "director.ict@itf.gov.ng", name: "Director ICT", role: UserRole.DIRECTOR, office: "Headquarters", department: "Information and Communication Technology", position: "Director ICT", hierarchyLevel: 4 },
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
  "director.ric@itf.gov.ng": "dg@itf.gov.ng",
  "director.sdo@itf.gov.ng": "dg@itf.gov.ng",
  "head.pass@itf.gov.ng": "director.ict@itf.gov.ng",
  "head.ncs@itf.gov.ng": "director.ict@itf.gov.ng",
  "head.hardware@itf.gov.ng": "director.ict@itf.gov.ng",
  "unit.apps@itf.gov.ng": "head.pass@itf.gov.ng",
  "officer.apps@itf.gov.ng": "unit.apps@itf.gov.ng",
};

async function main() {
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

  console.log(`Seeded ${demoUsers.length} ITF Flow demo users and reporting lines.`);
}

main().finally(() => db.$disconnect());
