import React from "react";
import type { CSSProperties } from "react";
import { resolveMaterialPresentation } from "../../../lib/materialPresentation";
import { materialShortCode } from "../../../lib/materialIdentity";

export type MaterialCoverageChip = { key: string; name: string; coverage: string };

export default function MaterialCoverageChips({ materials, variant = "list", label = "Selected material coverage" }: { materials: MaterialCoverageChip[]; variant?: "list" | "profile"; label?: string }) {
  if (!materials.length) return <span className="mining-coverage-empty">{variant === "list" ? "No selected materials" : "None"}</span>;
  return <span className={`mining-coverage-chips mining-coverage-chips--${variant}`} role="group" aria-label={label}>
    {materials.map(({ key, name, coverage }) => {
      const color = resolveMaterialPresentation(key).color;
      const covered = coverage === "Covered";
      const style: CSSProperties = covered ? {
        color: variant === "profile" ? `color-mix(in srgb, ${color} 58%, var(--mb-ws-text-muted))` : color,
        borderColor: `color-mix(in srgb, ${color} ${variant === "profile" ? 30 : 100}%, var(--mb-ws-line))`,
        background: `color-mix(in srgb, ${color} ${variant === "profile" ? 5 : 16}%, var(--mb-ws-raised))`,
      } : {};
      return <span key={key} className={`mining-coverage-chip${covered ? "" : " is-not-covered"}`}
        style={style} title={`${name}: ${coverage}`} aria-label={`${name}: ${coverage}`} tabIndex={0}
        onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
      >{materialShortCode(name)}</span>;
    })}
  </span>;
}

export function MaterialCoverageProfile({ materials }: { materials: MaterialCoverageChip[] }) {
  return <React.Fragment><div className="mining-coverage-profile">
    <div className="mining-coverage-group"><span className="mdet-method-label">Covered</span><MaterialCoverageChips variant="profile" label="Covered materials" materials={materials.filter((item) => item.coverage === "Covered")} /></div>
    <div className="mining-coverage-group"><span className="mining-coverage-label">Not Covered</span><MaterialCoverageChips variant="profile" label="Not covered materials" materials={materials.filter((item) => item.coverage !== "Covered")} /></div>
  </div></React.Fragment>;
}
