import type { MaterialIdentityInput, ResolvedApiMaterial } from "../shared/materialResolver";

export async function resolveBuildQueueMaterial(
  resolver: (input: MaterialIdentityInput) => ResolvedApiMaterial | null,
  input: MaterialIdentityInput,
) {
  return resolver(input);
}
