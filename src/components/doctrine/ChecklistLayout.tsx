import { useState, useCallback } from "react";
import type { DoctrineModule } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";

export function ChecklistLayout({ module }: { module: DoctrineModule }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const phases = module.phases ?? [];
  const allItems = phases.flatMap((ph, pi) =>
    ph.items.map((_, ii) => `${pi}-${ii}`)
  );
  const total = allItems.length;
  const done = allItems.filter((k) => checked.has(k)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = useCallback((key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => setChecked(new Set()), []);

  const singleCol = phases.length > 2;

  return (
    <div className="checklist-shell">
      <header className="checklist-header">
        <DoctrineModuleHeader module={module} eyebrow="Checklist" />
        {module.resetable !== false ? (
          <button className="dm-reset-btn" onClick={reset} type="button">
            Reset
          </button>
        ) : null}
      </header>

      {total > 0 ? (
        <div className="checklist-progress">
          <div className="dm-progress-track">
            <div
              className="dm-progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="dm-progress-label">
            {done}/{total}
          </span>
        </div>
      ) : null}

      {phases.length > 0 ? (
        <div
          className={[
            "checklist-body",
            singleCol ? "checklist-body--single-col" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {phases.map((phase, pi) => (
            <div key={pi} className="dm-phase-col">
              <div className="dm-phase-header">
                <span className="dm-phase-icon" />
                <p className="dm-phase-title">{phase.label}</p>
                <span className="dm-phase-count">{phase.items.length}</span>
              </div>
              <div className="dm-check-items">
                {phase.items.map((item, ii) => {
                  const key = `${pi}-${ii}`;
                  const isChecked = checked.has(key);
                  return (
                    <div
                      key={ii}
                      className={[
                        "dm-check-item",
                        isChecked ? "dm-check-item--checked" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggle(key)}
                    >
                      <div className="dm-custom-check" />
                      <span className="dm-check-text">{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
