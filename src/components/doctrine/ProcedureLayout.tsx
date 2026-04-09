import type { DoctrineModule } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";

export function ProcedureLayout({ module }: { module: DoctrineModule }) {
  const hasUseWhen = (module.useWhen?.length ?? 0) > 0;
  const hasFailure = (module.failureModes?.length ?? 0) > 0;
  const hasSidebar = hasUseWhen || hasFailure;

  return (
    <div
      className="procedure-shell"
      style={hasSidebar ? undefined : { gridTemplateColumns: "1fr" }}
    >
      <header className="procedure-header">
        <DoctrineModuleHeader module={module} eyebrow="Procedure" />
      </header>

      <main
        className="procedure-body"
        style={hasSidebar ? undefined : { borderRight: "none" }}
      >
        {module.steps && module.steps.length > 0 ? (
          <>
            <p className="dm-section-label">Execution</p>
            <div className="dm-step-list">
              {module.steps.map((step, i) => (
                <div key={i} className="dm-step-item">
                  <div className="dm-step-connector" />
                  <div className="dm-step-num">{i + 1}</div>
                  <div className="dm-step-content">
                    <p className="dm-step-label">{step.label}</p>
                    {step.detail ? (
                      <p className="dm-step-detail">{step.detail}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </main>

      {hasSidebar ? (
        <aside className="procedure-sidebar">
          {hasUseWhen ? (
            <div className="dm-sidebar-block dm-sidebar-block--info">
              <p className="dm-sidebar-title">Use When</p>
              <div className="dm-sidebar-items">
                {module.useWhen!.map((item, i) => (
                  <span key={i} className="dm-sidebar-item">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {hasFailure ? (
            <div className="dm-sidebar-block dm-sidebar-block--warn">
              <p className="dm-sidebar-title">Failure Modes</p>
              <div className="dm-sidebar-items">
                {module.failureModes!.map((item, i) => (
                  <span key={i} className="dm-sidebar-item dm-sidebar-item--danger">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
