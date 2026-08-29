import { resolveRecommenderStantonLagrangeChildren } from "../../../features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry } from "../../../features/mining/types";

export default function StantonLagrangeChildrenSummary({
  entry,
  compact = false,
}: {
  entry: PublicLocationEntry;
  compact?: boolean;
}) {
  if (entry.systemName.toLowerCase() !== "stanton") return null;

  const resolved = resolveRecommenderStantonLagrangeChildren(
    entry.locationName,
    entry.matchedLocationCodes,
  );

  if (resolved.children.length === 0) return null;

  return (
    <div
      className={`mloc-lagrange-children${compact ? " mloc-lagrange-children--compact" : ""}`}
      aria-label={`${entry.locationName} physical locations`}
      role="list"
    >
      {resolved.children.map((child) => (
        <span
          key={`${entry.locationKey}:lagrange:${child.code}`}
          className="mloc-lagrange-child-badge"
          role="listitem"
        >
          {child.code}
        </span>
      ))}
    </div>
  );
}
