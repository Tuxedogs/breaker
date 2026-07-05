import {
  resolveQualityBandNumber,
  rarityClassFromBandIndex,
  type QualityBand,
} from "../industry/crafting/utils/qualityBands";

type QualityTierBadgeProps = {
  quality?: number | null;
  qualityBand?: number | null;
  bands?: QualityBand[];
  className?: string;
  emptyLabel?: string;
  title?: string;
};

export default function QualityTierBadge({
  quality,
  qualityBand,
  bands,
  className = "",
  emptyLabel = "—",
  title,
}: QualityTierBadgeProps) {
  if (quality == null || !Number.isFinite(quality)) {
    return (
      <span className={`logi-quality-pill logi-quality-pill--empty ${className}`.trim()}>
        {emptyLabel}
      </span>
    );
  }

  const band = resolveQualityBandNumber(quality, qualityBand, bands);
  const tierClass = rarityClassFromBandIndex(band);

  return (
    <span
      className={`logi-quality-pill ${tierClass} ${className}`.trim()}
      title={title}
      data-quality-band={band ?? undefined}
    >
      {quality}
    </span>
  );
}
