import type { DoctrineModule } from "../../data/modules";
import { DoctrineModuleHeader } from "./DoctrineModuleHeader";

export function ConceptLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="concept-shell">
      <header className="concept-header">
        <DoctrineModuleHeader module={module} eyebrow="Concept" />
      </header>
      <div className="concept-body">
        <div className="concept-col">
          <module.Content />
        </div>
      </div>
    </div>
  );
}
