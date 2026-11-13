// Non-secret resource identities. Keep blocked until provider metadata and scopes are audited.
// This branch is staging-only; do not merge its environment policy into a release branch.
export const stagingManifest = {
  verified: true,
  branch: "staging",
  projectId: "prj_vbJxKdXwkV23mEHHdZMwVb89UMHl",
  candidate: "83eddd4b1cd2117a38b92bf7e7b4687e87b654f6",
  origin: "https://breaker-staging-git-staging-produtux.vercel.app",
  supabaseRef: "bqmqszakdhitogqluels",
  neonProjectId: "red-firefly-12706801",
  neonBranchId: "br-royal-hill-b7nxcnzk",
  databaseHost: "ep-odd-sunset-b7e5utuu-pooler.c-13.us-east-1.aws.neon.tech",
  databaseName: "breaker_staging",
  databaseRole: "breaker_staging_app",
  migrationRole: "breaker_staging_migrator",
  isolationId: "566bfc7c-c4be-43a1-aa4a-f3d3fae33924",
  productionSupabaseRefs: ["toobryzjjzqnluthoawj"] as string[],
  productionDatabaseHosts: ["ep-nameless-firefly-ap68klhf-pooler.c-7.us-east-1.aws.neon.tech"] as string[],
  productionDatabaseRoles: ["neondb_owner"] as string[],
};
