export type ModuleFilters = {
  ship: string;
  role: string;
  enemy: string;
  map: string;
  status: string;
  type: string;
  domain: string;
};

export const emptyModuleFilters: ModuleFilters = {
  ship: "",
  role: "",
  enemy: "",
  map: "",
  status: "",
  type: "",
  domain: "",
};

export function readModuleFilters(searchParams: URLSearchParams): ModuleFilters {
  return {
    ship: searchParams.get("ship") ?? "",
    role: searchParams.get("role") ?? "",
    enemy: searchParams.get("enemy") ?? "",
    map: searchParams.get("map") ?? "",
    status: searchParams.get("status") ?? "",
    type: searchParams.get("type") ?? "",
    domain: searchParams.get("domain") ?? "",
  };
}

export function writeModuleFilters(filters: ModuleFilters): URLSearchParams {
  const params = new URLSearchParams();
  const entries = Object.entries(filters) as Array<[keyof ModuleFilters, string]>;
  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}
