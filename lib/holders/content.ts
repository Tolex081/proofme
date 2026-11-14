/**
 * What the credential-gated page unlocks. Fictional demo content: a board of
 * paid opportunities that only people holding a valid Atesta credential can
 * see. It is sent to the browser only after the server has checked the
 * holder's wallet and credentials (see server/services/holders.ts).
 */
export interface HolderContent {
  title: string;
  note: string;
  opportunities: { organisation: string; role: string; detail: string }[];
}

export const HOLDER_CONTENT: HolderContent = {
  title: "Verified contributor opportunities",
  note: "Sample content for the Atesta demo. These organisations and roles are fictional.",
  opportunities: [
    {
      organisation: "Northstar Protocol",
      role: "Paid proposal reviewer, Open Grants round 4",
      detail: "Score 20 proposals a week. Open only to contributors with a verified credential.",
    },
    {
      organisation: "Harbour Hack",
      role: "Mentor, December cohort",
      detail: "Guide three first-time teams for two weekends. Stipend paid in NEAR.",
    },
    {
      organisation: "Meridian DAO",
      role: "Documentation lead (contract)",
      detail: "Rewrite the contributor guide. Verified writers fast-tracked past the trial task.",
    },
  ],
};
