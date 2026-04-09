import { moduleById } from "../../data/modules";
import type { DoctrineModule } from "../../data/modules";
import ModuleFilterChipLink from "../ModuleFilterChipLink";

type Props = {
  module: DoctrineModule;
  eyebrow: string;
};

export function DoctrineModuleHeader({ module, eyebrow }: Props) {
  return (
    <div>
      <p className="dm-eyebrow">{eyebrow}</p>
      <h1 className="dm-title">{module.title}</h1>
      {module.summary ? <p className="dm-summary">{module.summary}</p> : null}
      <div className="dm-meta-strip">
        <div className="dm-meta-item">
          <span className="dm-meta-label">Status</span>
          <span className="dm-meta-value">{module.status}</span>
        </div>
        {module.validatedDate ? (
          <div className="dm-meta-item">
            <span className="dm-meta-label">Validated</span>
            <span className="dm-meta-value dm-meta-value--validated">
              {module.validatedDate}
            </span>
          </div>
        ) : null}
        <div className="dm-meta-item">
          <span className="dm-meta-label">Owner</span>
          <span className="dm-meta-value">{module.owner}</span>
        </div>
        {module.tags.length > 0 ? (
          <div className="dm-tag-row">
            {module.tags.map((tag) => (
              <ModuleFilterChipLink key={tag} tag={tag} className="dm-tag" />
            ))}
          </div>
        ) : null}
      </div>
      {module.relatedModuleIds.length > 0 ? (
        <div className="dm-related-strip">
          <p className="dm-related-label">Related Doctrine</p>
          <div className="dm-related-list">
            {module.relatedModuleIds.map((id) => {
              const rel = moduleById.get(id);
              if (!rel) return null;
              return (
                <a key={id} href={`/module/${id}`} className="dm-related-card">
                  <span className="dm-related-card-title">{rel.title}</span>
                  {rel.summary ? (
                    <span className="dm-related-card-summary">{rel.summary}</span>
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}