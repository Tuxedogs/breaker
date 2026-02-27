import { Link } from "react-router-dom";
import { moduleFilterOptions } from "../data/modules";

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function toModulesFilterHref(tag: string) {
  const normalized = normalizeTag(tag);
  const params = new URLSearchParams();

  if (moduleFilterOptions.ships.includes(normalized)) {
    params.set("ship", normalized);
  } else if (moduleFilterOptions.roles.includes(normalized)) {
    params.set("role", normalized);
  } else if (moduleFilterOptions.enemies.includes(normalized)) {
    params.set("enemy", normalized);
  } else if (moduleFilterOptions.maps.includes(normalized)) {
    params.set("map", normalized);
  } else if (moduleFilterOptions.statuses.includes(normalized as (typeof moduleFilterOptions.statuses)[number])) {
    params.set("status", normalized);
  } else if (moduleFilterOptions.types.includes(normalized as (typeof moduleFilterOptions.types)[number])) {
    params.set("type", normalized);
  } else {
    params.set("domain", normalized);
  }

  return `/modules?${params.toString()}`;
}

type ModuleFilterChipLinkProps = {
  tag: string;
  className?: string;
};

export default function ModuleFilterChipLink({ tag, className = "" }: ModuleFilterChipLinkProps) {
  return (
    <Link to={toModulesFilterHref(tag)} className={`module-chip-link ${className}`.trim()}>
      {tag}
    </Link>
  );
}

