import { Link, useParams } from "react-router-dom";
import EngagementEnvelope from "../components/EngagementEnvelope";
import ModuleFilterChipLink from "../components/ModuleFilterChipLink";
import { moduleById, moduleLoadError } from "../data/modules";
import { refByKey, refLoadError } from "../data/refs";

function SectionList({
  title,
  items,
  variant = "default",
}: {
  title: string;
  items: string[];
  variant?: "default" | "steps" | "failure" | "validation";
}) {
  const cardClass =
    variant === "failure"
      ? "doctrine-block doctrine-block-failure"
      : variant === "validation"
        ? "doctrine-block doctrine-block-validation"
        : variant === "steps"
          ? "doctrine-block doctrine-block-steps"
          : "doctrine-block";

  const listClass =
    variant === "validation"
      ? "doctrine-checklist"
      : variant === "failure"
        ? "list-disc space-y-1.5 pl-5"
        : variant === "steps"
          ? "list-decimal space-y-2 pl-5"
        : "list-disc space-y-1.5 pl-5";

  return (
    <section className={`framework-modern-card-head rounded-xl p-4 ${cardClass}`}>
      <h2 className="title-font text-xl text-cyan-100">{title}</h2>
      <ul className={`mt-3 text-slate-200 ${listClass}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function DoctrineModulePage() {
  const loaderError = moduleLoadError ?? refLoadError;
  const { id = "" } = useParams();
  const module = moduleById.get(id);

  if (loaderError) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-cyan-100">Module Content Error</h1>
            <p className="mt-3 text-slate-300">{loaderError.message}</p>
          </div>
          <Link to="/modules" className="framework-modern-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }

  if (!module) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-cyan-100">Module Not Found</h1>
          </div>
          <Link to="/modules" className="framework-modern-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="route-fade py-3">
      <div className="space-y-5">
        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <header className="framework-modern-card-head rounded-xl p-5">
            <p className="framework-modern-kicker">Doctrine Module</p>
            <h1 className="title-font mt-2 text-3xl text-cyan-100 sm:text-4xl">{module.title}</h1>
            <p className="mt-3 rounded-lg border border-cyan-200/35 bg-cyan-950/45 px-3 py-2 text-base text-cyan-50">
              {module.intent}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">
              Status: {module.status} | Last Validated: {module.lastValidated} | Owner: {module.owner}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {module.tags.map((tag) => (
                <ModuleFilterChipLink
                  key={tag}
                  tag={tag}
                  className="inline-flex h-8 items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs uppercase tracking-[0.14em] text-cyan-100"
                />
              ))}
            </div>
          </header>
        </article>

        {module.powerProjection.length > 0 ? (
          <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
            <EngagementEnvelope items={module.powerProjection} />
          </article>
        ) : null}

        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionList title="Use When" items={module.useWhen} />
            <SectionList title="Steps" items={module.steps} variant="steps" />
            <SectionList title="Failure Modes" items={module.failureModes} variant="failure" />
            <SectionList title="Validation" items={module.validation} variant="validation" />
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="framework-modern-card-head rounded-xl p-4">
              <h2 className="title-font text-xl text-cyan-100">Prerequisites</h2>
              <div className="mt-3 space-y-2">
                {module.prerequisites.length === 0 ? <p className="text-slate-300">None</p> : null}
                {module.prerequisites.map((refId) => {
                  const ref = refByKey.get(refId);
                  if (!ref) {
                    return (
                      <p key={refId} className="text-slate-300">
                        {refId}
                      </p>
                    );
                  }
                  return (
                    <Link key={refId} to={`/refs/${ref.refType}/${ref.id}`} className="framework-modern-row rounded-lg p-3">
                      {ref.title}
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="framework-modern-card-head rounded-xl p-4">
              <h2 className="title-font text-xl text-cyan-100">Related Modules</h2>
              <div className="mt-3 space-y-2">
                {module.relatedModuleIds.length === 0 ? <p className="text-slate-300">None</p> : null}
                {module.relatedModuleIds.map((relatedId) => {
                  const related = moduleById.get(relatedId);
                  if (!related) return null;
                  return (
                    <Link key={relatedId} to={`/module/${relatedId}`} className="framework-modern-row rounded-lg p-3">
                      {related.title}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </article>

      </div>
    </section>
  );
}
