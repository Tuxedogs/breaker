const FRAME_ASSET_ROOT = "/assets/ui/frames";

export type BuildQueueFrameAsset =
  | "queue-header-frame.svg"
  | "queue-item-frame.svg"
  | "queue-item-frame-active.svg"
  | "content-shell-frame.svg"
  | "detail-panel-frame.svg"
  | "item-preview-frame.svg"
  | "stats-band-frame.svg"
  | "material-panel-frame.svg"
  | "material-row-frame.svg";

export default function BuildQueueFrame({ asset }: { asset: BuildQueueFrameAsset }) {
  return (
    <img
      className="bq-decorative-frame"
      src={`${FRAME_ASSET_ROOT}/${asset}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
