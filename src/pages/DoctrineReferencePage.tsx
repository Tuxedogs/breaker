import { Link, useParams } from "react-router-dom";
import ModuleFilterChipLink from "../components/ModuleFilterChipLink";
import { refLoadError, refs } from "../data/refs";

export default function DoctrineReferencePage() {
  const { type = "", id = "" } = useParams();

  if (refLoadError) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-maps framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-blue-100">Reference Content Error</h1>
            <p className="mt-3 text-slate-300">{refLoadError.message}</p>
          </div>
          <Link to="/modules" className="framework-modern-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }
  const reference = refs.find((item) => item.refType === type && item.id === id);

  if (!reference) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-maps framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-blue-100">Reference Not Found</h1>
          </div>
          <Link to="/modules" className="framework-modern-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }

  const RefContent = reference.Content;

  return (
    <section className="route-fade py-3">
      <article className="framework-modern-card framework-modern-card-maps framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
        <header className="framework-modern-card-head rounded-xl p-5">
          <p className="framework-modern-kicker">Reference</p>
          <h1 className="title-font mt-2 text-3xl text-blue-100 sm:text-4xl">{reference.title}</h1>
          <p className="mt-3 text-sm text-slate-200">{reference.summary ?? "Non-procedural reference content."}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">
            Type: {reference.refType} | Last Updated: {reference.lastUpdated}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {reference.tags.map((tag) => (
              <ModuleFilterChipLink
                key={tag}
                tag={tag}
                className="inline-flex h-8 items-center rounded-full border border-blue-300/30 bg-blue-300/10 px-3 text-xs uppercase tracking-[0.14em] text-blue-100"
              />
            ))}
          </div>
        </header>
        <div className="framework-modern-card-head prose prose-invert mt-1 max-w-none rounded-xl p-5 text-slate-200">
          <RefContent />
        </div>
      </article>
    </section>
  );
}
