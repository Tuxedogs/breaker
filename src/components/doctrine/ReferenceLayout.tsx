import type { DoctrineModule } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";

export function ReferenceLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="reference-shell">
      <header className="reference-header">
        <DoctrineModuleHeader module={module} eyebrow="Reference" />
      </header>

      <div className="reference-body">
        {module.notes && module.notes.length > 0 ? (
          <>
            <p className="dm-section-label">Notes</p>
            <div>
              {module.notes.map((note, i) => (
                <div key={i} className="dm-reference-note">
                  {note}
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div
          className="dm-reference-prose"
          style={
            module.notes && module.notes.length > 0
              ? { marginTop: 24 }
              : undefined
          }
        >
          <module.Content />
        </div>
      </div>
    </div>
  );
}
