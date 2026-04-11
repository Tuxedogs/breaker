import type { DoctrineModule, DiagramImage } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";

function buildImageList(module: DoctrineModule): DiagramImage[] {
  if (module.images && module.images.length > 0) return module.images;
  if (module.assetPath) {
    return [{ src: module.assetPath, caption: module.caption }];
  }
  return [];
}

function Mosaic({ images }: { images: DiagramImage[] }) {
  const count = images.length;

  if (count === 0) {
    return (
      <div
        className="dm-mosaic"
        style={{ gridTemplateColumns: "1fr", minHeight: 240 }}
      >
        <div
          className="dm-mosaic-cell"
          style={{ aspectRatio: "unset", minHeight: 240 }}
        >
          <span style={{ color: "var(--dm-text-dim)", fontSize: 13 }}>
            No diagram asset
          </span>
        </div>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div
        className="dm-mosaic"
        style={{ gridTemplateColumns: "1fr", minHeight: 260 }}
      >
        <div
          className="dm-mosaic-cell"
          style={{ aspectRatio: "16/9" }}
        >
          <img
            src={images[0].src}
            alt={images[0].caption ?? "Diagram"}
            className="dm-mosaic-img"
          />
        </div>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div
        className="dm-mosaic"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {images.map((img, i) => (
          <div key={i} className="dm-mosaic-cell">
            <img src={img.src} alt={img.caption ?? `Image ${i + 1}`} className="dm-mosaic-img" />
          </div>
        ))}
      </div>
    );
  }

  // 3+ images: primary + thumbnails (show max 4, overlay on 4th if more)
  const visible = images.slice(0, 4);
  const overflow = images.length - 4;
  const hasPrimary = true;

  return (
    <div
      className="dm-mosaic"
      style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto" }}
    >
      {visible.map((img, i) => {
        const isPrimary = hasPrimary && i === 0;
        const isLast = i === visible.length - 1 && overflow > 0;

        return (
          <div
            key={i}
            className={[
              "dm-mosaic-cell",
              isPrimary ? "dm-mosaic-cell--primary" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <img
              src={img.src}
              alt={img.caption ?? `Image ${i + 1}`}
              className="dm-mosaic-img"
            />
            {isLast ? (
              <div className="dm-mosaic-more">+{overflow + 1}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function DiagramLayout({ module }: { module: DoctrineModule }) {
  const images = buildImageList(module);
  const hasSidebar =
    !!module.caption ||
    (module.legend?.length ?? 0) > 0;

  return (
    <div className="gallery-shell">
      <header className="gallery-header">
        <DoctrineModuleHeader module={module} eyebrow="Gallery / Maps" />
      </header>

      <div
        className="gallery-layout"
        style={hasSidebar ? undefined : { gridTemplateColumns: "1fr" }}
      >
        <div className="gallery-main">
          <Mosaic images={images} />
        </div>

        {hasSidebar ? (
          <aside className="gallery-sidebar">
            {module.caption ? (
              <div>
                <p className="dm-gallery-meta-label">Caption</p>
                <p className="dm-gallery-meta-val">{module.caption}</p>
              </div>
            ) : null}

            {module.legend && module.legend.length > 0 ? (
              <div>
                <p className="dm-gallery-meta-label">Legend</p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {module.legend.map((item, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--dm-text-muted)",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
