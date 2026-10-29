import { defineRailway, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "finance-manager-ai";
export default defineRailway(() => {
  const financeManagerAi = service("finance-manager-ai", {
    build: { buildEnvironment: "V3", builder: "RAILPACK" },
    start: "npm run start",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    preDeploy: "npm run db:migrate",
    replicas: { "iad": 1 },
  });

  return project("finance-manager-ai", {
    variables: { managed: false },
    resources: [financeManagerAi],
  });
});
