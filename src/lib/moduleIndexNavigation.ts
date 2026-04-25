import { useEffect } from "react";
import { readModuleFilters } from "./moduleFilters";

const moduleIndexSearchStorageKey = "moonbreaker:last-module-index-search";

const roleIndexLabels: Record<string, string> = {
  crew: "Crew",
  engineer: "Engineering",
  engineering: "Engineering",
  gunner: "Gunnery",
  gunnery: "Gunnery",
  pilot: "Pilot",
};

function normalizeSearch(search: string) {
  if (!search || search === "?") return "";
  return search.startsWith("?") ? search : `?${search}`;
}

export function rememberModuleIndexSearch(search: string) {
  if (typeof window === "undefined") return;

  const normalizedSearch = normalizeSearch(search);
  if (normalizedSearch) {
    window.sessionStorage.setItem(moduleIndexSearchStorageKey, normalizedSearch);
  } else {
    window.sessionStorage.removeItem(moduleIndexSearchStorageKey);
  }
}

export function getModuleIndexHref(fallbackSearch = "") {
  const normalizedFallback = normalizeSearch(fallbackSearch);
  if (normalizedFallback) return `/doctrine${normalizedFallback}`;

  if (typeof window === "undefined") return "/doctrine";

  const storedSearch = normalizeSearch(
    window.sessionStorage.getItem(moduleIndexSearchStorageKey) ?? "",
  );
  return storedSearch ? `/doctrine${storedSearch}` : "/doctrine";
}

function getModuleIndexSearch(fallbackSearch = "") {
  const normalizedFallback = normalizeSearch(fallbackSearch);
  if (normalizedFallback) return normalizedFallback;

  if (typeof window === "undefined") return "";

  return normalizeSearch(
    window.sessionStorage.getItem(moduleIndexSearchStorageKey) ?? "",
  );
}

function toRoleIndexLabel(role: string) {
  const normalizedRole = role.trim();
  if (!normalizedRole) return "";

  const lookupKey = normalizedRole.toLowerCase();
  if (roleIndexLabels[lookupKey]) return roleIndexLabels[lookupKey];
  if (normalizedRole === normalizedRole.toUpperCase()) return normalizedRole;

  return normalizedRole
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getModuleIndexReturnLabel(fallbackSearch = "") {
  const search = getModuleIndexSearch(fallbackSearch);
  const role = readModuleFilters(new URLSearchParams(search)).role;
  const roleLabel = toRoleIndexLabel(role);

  return roleLabel
    ? `Return to ${roleLabel} Index`
    : "Return to Module Index";
}

export function useRememberModuleIndexSearch(search: string) {
  useEffect(() => {
    rememberModuleIndexSearch(search);
  }, [search]);
}
