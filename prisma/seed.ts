import "dotenv/config";
import bcrypt from "bcryptjs";
import { UserRole } from "../lib/generated/prisma/client";
import { db } from "../lib/db";

const demoUsers = [
  { email: "secretary.abuja@itf.gov.ng", name: "Amina Yusuf", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Abuja", position: "DG Secretary", hierarchyLevel: 4 },
  { email: "secretary.jos@itf.gov.ng", name: "Grace Danladi", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Jos", position: "DG Secretary", hierarchyLevel: 4 },
  { email: "secretary.lagos@itf.gov.ng", name: "Chioma Okeke", role: UserRole.DG_SECRETARY, office: "DG Secretariat — Lagos", position: "DG Secretary", hierarchyLevel: 4 },
  { email: "dg@itf.gov.ng", name: "Director-General", role: UserRole.DG, office: "Director-General's Office", position: "Director-General", hierarchyLevel: 5 },
  { email: "director.ict@itf.gov.ng", name: "Director ICT", role: UserRole.DIRECTOR, office: "Headquarters", department: "Information and Communication Technology", position: "Director ICT", hierarchyLevel: 4 },
  { email: "director.ric@itf.gov.ng", name: "Director Revenue, Inspectorate and Compliance", role: UserRole.DIRECTOR, office: "Headquarters", department: "Revenue, Inspectorate and Compliance", position: "Director RIC", hierarchyLevel: 4 },
  { email: "director.sdo@itf.gov.ng", name: "Director SDO", role: UserRole.DIRECTOR, office: "Headquarters", department: "Service Development and Operations", position: "Director SDO", hierarchyLevel: 4 },
  { email: "head.pass@itf.gov.ng", name: "Head PASS Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "PASS", position: "Division Head", hierarchyLevel: 3 },
  { email: "head.ncs@itf.gov.ng", name: "Head NCS Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "NCS", position: "Division Head", hierarchyLevel: 3 },
  { email: "head.hardware@itf.gov.ng", name: "Head Hardware Division", role: UserRole.DIVISION_HEAD, office: "Headquarters", department: "ICT", division: "Hardware", position: "Division Head", hierarchyLevel: 3 },
  { email: "unit.apps@itf.gov.ng", name: "Head Applications Unit", role: UserRole.UNIT_HEAD, office: "Headquarters", department: "ICT", division: "PASS", position: "Unit Head", hierarchyLevel: 2 },
  { email: "officer.apps@itf.gov.ng", name: "Applications Officer", role: UserRole.OFFICER, office: "Headquarters", department: "ICT", division: "PASS", position: "ICT Officer", hierarchyLevel: 1 },
];

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "Demo123!", 12);
  for (const user of demoUsers) {
    await db.user.upsert({
      where: { email: user.email },
      update: { ...user, passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }
  console.log(`Seeded ${demoUsers.length} ITF Flow demo users.`);
}

main().finally(() => db.$disconnect());
