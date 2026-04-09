import type { DoctrineModule } from "../../data/modules";

export function ConceptLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--concept space-y-5">
      <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Concept</p>
            <h1 className="doctrine-hero-title">{module.title}</h1>
            {module.summary ? (
              <p className="doctrine-hero-summary">{module.summary}</p>
            ) : null}
          </div>
        </header>
      </article>
      <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
        <module.Content />
      </article>
    </div>
  );
}
