export type OrganizationUnitOption = {
  key: string;
  name: string;
  level: "OFFICE" | "DEPARTMENT" | "DIVISION" | "UNIT";
};

export type RecordSeriesOption = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  version: number;
  defaultOwnerOrgUnitKey: string | null;
  defaultOwnerOrgUnitName: string | null;
  legacyUnit: string | null;
  legacyBoxCategory: string | null;
  retentionPolicy: {
    id: string;
    code: string;
    name: string;
    description: string;
    trigger: string;
    durationYears: number | null;
    disposition: string;
    version: number;
  };
};

export const recordCategoryGuidance: Record<string, string> = {
  OFFICE: "Use for operational records belonging to a department, division or unit, such as ICT maintenance or departmental planning.",
  PERSONNEL: "Use when the correspondence is officially about a named staff member, such as a query, appointment, promotion or disciplinary matter.",
  CORPORATE: "Use for institution-wide records that belong to ITF as an organization, such as approved policies and corporate directives.",
  EXTERNAL_CASE: "Use for an ongoing matter involving an external person or organization, such as a vendor contract, complaint or stakeholder case.",
};

export function retentionPolicySummary(policy: RecordSeriesOption["retentionPolicy"]) {
  if (policy.trigger === "PERMANENT" || policy.disposition === "PERMANENT") return `${policy.name}. Retain permanently.`;
  const duration = policy.durationYears ? `${policy.durationYears} year${policy.durationYears === 1 ? "" : "s"}` : "the approved period";
  const trigger = policy.trigger.toLowerCase().replaceAll("_", " ");
  return `${policy.name}. Retain for ${duration} from ${trigger}; final disposition: ${policy.disposition.toLowerCase()}.`;
}

export function normalizedLegacyKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => String(part ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "none").join(":");
}
