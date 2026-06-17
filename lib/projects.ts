// Registry of Pacific projects the hub expects to track. Any project here
// without a matching projectRoadmap document is shown in the "Not yet
// reporting" list, so missing coverage is visible rather than silent.
export type ExpectedProject = { key: string; name: string };

export const EXPECTED_PROJECTS: ExpectedProject[] = [
  { key: "pad", name: "Pacific Assurance Dashboard" },
  { key: "roadmap-hub", name: "Portfolio Roadmap Hub" },
  { key: "ptg-website", name: "PTG Marketing Website" },
  { key: "pthm-email", name: "PTHM Email Hardening (DMARC)" },
  { key: "partner-portal-ptg", name: "PTG Partner Portal" },
  { key: "partner-portal-pi", name: "Pacific Infotech Partner Portal" },
  { key: "avatar-pipeline", name: "AI Avatar Pipeline" },
];
