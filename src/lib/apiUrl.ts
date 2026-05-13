export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = (import.meta.env.VITE_SCINTEL_API_BASE_URL ?? "").trim();

  if (!base) return normalizedPath;

  return `${base.replace(/\/+$/, "")}/${normalizedPath.replace(/^\/+/, "")}`;
}
