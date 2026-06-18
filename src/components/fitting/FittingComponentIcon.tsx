import { useMemo, useState } from "react";
import { type FittingIconMode } from "../../lib/fitting/fittingIconMode";
import {
  resolveFittingComponentIcon,
  type ResolveFittingComponentIconInput,
} from "../../lib/fitting/resolveFittingComponentIcon";

type FittingComponentIconProps = ResolveFittingComponentIconInput & {
  preferredMode: FittingIconMode;
  alt?: string;
  className?: string;
  iconSize?: "sm" | "md";
};

export function FittingComponentIcon({
  componentType,
  componentName,
  familyKey,
  size,
  preferredMode,
  alt,
  className,
  iconSize = "md",
}: FittingComponentIconProps) {
  const resolved = useMemo(
    () => resolveFittingComponentIcon({
      componentType,
      componentName,
      familyKey,
      size,
      preferredMode,
    }),
    [componentName, componentType, familyKey, preferredMode, size],
  );
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const classNames = [
    "fit-component-icon",
    iconSize === "sm" ? "fit-component-icon--sm" : "",
    resolved.resolvedMode === "placeholder" ? "fit-component-icon--placeholder" : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  const src = failedSrc === resolved.src
    ? "/images/component-icons/size_weapon_generic.webp"
    : resolved.src;

  return (
    <img
      className={classNames}
      src={src}
      alt={alt ?? componentName ?? "Component icon"}
      loading="lazy"
      decoding="async"
      title={resolved.reason}
      onError={() => setFailedSrc(resolved.src)}
    />
  );
}