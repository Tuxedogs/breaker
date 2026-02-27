import { Link, useParams } from "react-router-dom";
import { moduleById } from "../data/modules";
import { refByKey } from "../data/refs";
import { shipHubBySlug, shipLoadError, type ShipRoleLens } from "../data/ships";
import { useMemo, useState } from "react";

const roleLensOrder: ShipRoleLens[] = ["pilot", "gunner", "engineer"];

export default function ShipHubPage() {
  const { slug = "" } = useParams();
  const [activeLens, setActiveLens] = useState<ShipRoleLens>("pilot");
  const ship = shipHubBySlug.get(slug);

  const recommendedModules = useMemo(() => {
    if (!ship) return [];
    return ship.recommendedModuleIds
      .map((id) => moduleById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((module) => module.roles.length === 0 || module.roles.includes(activeLens));
  }, [ship, activeLens]);

  if (shipLoadError) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-amber-100">Ship Hub Content Error</h1>
            <p className="mt-3 text-slate-300">{shipLoadError.message}</p>
          </div>
          <Link to="/index" className="framework-modern-cta mt-2">
            Go to Framework Index
          </Link>
        </article>
      </section>
    );
  }

  if (!ship) {
    return (
      <section className="route-fade py-8">
        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.5rem] p-4">
          <div className="framework-modern-card-head rounded-xl p-5">
            <h1 className="title-font text-3xl text-amber-100">Ship Hub Not Found</h1>
            <p className="mt-3 text-slate-300">No ship hub is published for slug "{slug}".</p>
          </div>
          <Link to="/index" className="framework-modern-cta mt-2">
            Go to Framework Index
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="route-fade ship-framework pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.9rem] border border-amber-300/35 p-4 sm:p-6">
          <div className="grid gap-6">
            <header className="framework-modern-card-head rounded-[1.2rem] p-5">
              <p className="framework-modern-kicker">Ship Hub</p>
              <h1 className="title-font mt-2 text-4xl text-amber-100">{ship.name}</h1>
              {ship.loadoutAssumption ? <p className="mt-4 text-sm text-slate-300">{ship.loadoutAssumption}</p> : null}
            </header>
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.9rem] border border-amber-300/35 p-4 sm:p-6">
          <div className="framework-modern-card-head rounded-[1.2rem] p-5">
            <h2 className="title-font text-2xl text-amber-100">Overview</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <section>
                <h3 className="title-font text-sm uppercase tracking-[0.16em] text-amber-200">Primary Role Flow</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-200">
                  {ship.primaryRoleFlow.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="title-font text-sm uppercase tracking-[0.16em] text-amber-200">Common Failure Modes</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-200">
                  {ship.commonFailureModes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.9rem] border border-amber-300/35 p-4 sm:p-6">
          <div className="framework-modern-card-head rounded-[1.2rem] p-5">
            <h2 className="title-font text-2xl text-amber-100">Role Lenses</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {roleLensOrder.map((lens) => (
                <button
                  key={lens}
                  type="button"
                  onClick={() => setActiveLens(lens)}
                  className={[
                    "inline-flex h-11 min-w-[120px] items-center justify-center rounded-lg border px-4 text-xs uppercase tracking-[0.16em]",
                    activeLens === lens
                      ? "border-amber-300/55 bg-amber-300/15 text-amber-100"
                      : "border-white/25 bg-white/5 text-slate-200",
                  ].join(" ")}
                >
                  {lens}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {recommendedModules.map((module) => (
              <article key={module.id} className="framework-modern-row rounded-xl p-4">
                <div className="min-w-0">
                  <h3 className="title-font text-lg text-slate-100">{module.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{module.intent}</p>
                </div>
                <Link to={`/module/${module.id}`} className="ml-auto inline-flex h-11 items-center rounded-lg border border-amber-300/35 px-4 text-xs uppercase tracking-[0.16em] text-amber-100">
                  View Module
                </Link>
              </article>
            ))}
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-ships framework-modern-card-compact rounded-[1.9rem] border border-amber-300/35 p-4 sm:p-6">
          <div className="framework-modern-card-head rounded-[1.2rem] p-5">
            <h2 className="title-font text-2xl text-amber-100">References</h2>
            <p className="mt-2 text-sm text-slate-300">Reference pages only, no procedural doctrine.</p>
          </div>
          <div className="space-y-3">
            {ship.referenceIds.map((refId) => {
              const ref = refByKey.get(refId);
              if (!ref) return null;
              return (
                <article key={refId} className="framework-modern-row rounded-xl p-4">
                  <div>
                    <h3 className="title-font text-lg text-slate-100">{ref.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{ref.summary ?? "Reference content."}</p>
                  </div>
                  <Link to={`/refs/${ref.refType}/${ref.id}`} className="ml-auto inline-flex h-11 items-center rounded-lg border border-amber-300/35 px-4 text-xs uppercase tracking-[0.16em] text-amber-100">
                    Open Ref
                  </Link>
                </article>
              );
            })}
            {ship.operationalLinks?.map((item) => (
              <article key={item.id} className="framework-modern-row rounded-xl p-4">
                <div>
                  <h3 className="title-font text-lg text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{item.summary}</p>
                </div>
                <Link to={item.to} className="ml-auto inline-flex h-11 items-center rounded-lg border border-amber-300/35 px-4 text-xs uppercase tracking-[0.16em] text-amber-100">
                  Open Page
                </Link>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
