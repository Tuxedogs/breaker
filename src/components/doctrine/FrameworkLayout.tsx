import type { DoctrineModule } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";
import { DoctrineContent } from "./DoctrineContent";

const RANK_CLASS: Record<number, string> = {
  0: "dm-rank-1",
  1: "dm-rank-2",
  2: "dm-rank-3",
};

const ROLE_COLOR: Record<string, string> = {
  pilot: 'var(--pilot-gold)',
  gunner: 'var(--gunnery)',
  engineer: 'var(--engineer)',
  crew: 'var(--crew-blue)',
};

export function FrameworkLayout({ module }: { module: DoctrineModule }) {
  const hasSidebar =
    (module.matrix?.length ?? 0) > 0 || (module.output?.length ?? 0) > 0;

  const roleColor = ROLE_COLOR[module.roles?.[0] ?? 'crew'] ?? 'var(--crew-blue)';

  return (
    <div className="priority-shell" style={{ borderTopColor: roleColor }}>
      <header className="priority-header">
        <DoctrineModuleHeader module={module} eyebrow="Priority Ladder" />
      </header>
      <div
        className="priority-layout"
        style={hasSidebar ? { alignItems: 'start' } : { gridTemplateColumns: "1fr", alignItems: 'start' }}
      >
        <div className="priority-main">
          {module.criteria && module.criteria.length > 0 ? (
            <>
              <span className="dm-section-label dm-section-label--padded">
                Criteria
              </span>
              <div className="dm-ladder">
                {module.criteria.map((item, i) => (
                  <div key={i} className="dm-ladder-item">
                    <div className={["dm-ladder-rank", RANK_CLASS[i] ?? "dm-rank-4"].join(" ")}>
                      {i + 1}
                    </div>
                    <div className="dm-ladder-content">
                      <p className="dm-ladder-title">{item.label}</p>
                      {item.description ? (
                        <p className="dm-ladder-desc">{item.description}</p>
                      ) : null}
                    </div>
                    {item.weight ? (
                      <div className="dm-ladder-weight">
                        <span className={["dm-weight-badge", `dm-weight-${item.weight}`].join(" ")}>
                          {item.weight}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <DoctrineContent module={module} />
        </div>
        {hasSidebar ? (
          <aside className="priority-sidebar">
            {module.matrix && module.matrix.length > 0 ? (
              <div className="dm-sidebar-block">
                <table className="dm-matrix-table">
                  <thead>
                    <tr>
                      <th>Condition</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {module.matrix.map((row, i) => (
                      <tr key={i}>
                        <td>{row.condition}</td>
                        <td>{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {module.output && module.output.length > 0 ? (
              <div className="dm-sidebar-block dm-sidebar-block--info">
                <div className="dm-sidebar-items">
                  {module.output.map((item, i) => (
                    <div key={i} className="dm-sidebar-item">
                      <span>
                        <strong style={{ color: "var(--dm-text)", display: "block" }}>
                          {item.label}
                        </strong>
                        {item.description}
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