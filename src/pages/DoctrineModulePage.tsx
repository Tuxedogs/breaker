import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { moduleById, moduleLoadError } from "../data/modules";
import type { DoctrineModule, ModuleType } from "../data/modules";
import type { ComponentType } from "react";
import { ProcedureLayout } from "../components/doctrine/ProcedureLayout";
import { FrameworkLayout } from "../components/doctrine/FrameworkLayout";
import { ReferenceLayout } from "../components/doctrine/ReferenceLayout";
import { ConceptLayout } from "../components/doctrine/ConceptLayout";
import { DiagramLayout } from "../components/doctrine/DiagramLayout";
import { ChecklistLayout } from "../components/doctrine/ChecklistLayout";

const layouts: Record<ModuleType, ComponentType<{ module: DoctrineModule }>> = {
  procedure: ProcedureLayout,
  framework: FrameworkLayout,
  reference: ReferenceLayout,
  concept: ConceptLayout,
  diagram: DiagramLayout,
  checklist: ChecklistLayout,
  flying: ProcedureLayout,
  manning: ProcedureLayout,
  facing: ProcedureLayout,
  recovery: ProcedureLayout,
};

export default function DoctrineModulePage() {
  const loaderError = moduleLoadError;
  const { id = "" } = useParams();
  const module = moduleById.get(id);

  useEffect(() => {
    if (module?.accent) {
      document.documentElement.style.setProperty("--module-accent", module.accent);
    } else {
      document.documentElement.style.removeProperty("--module-accent");
    }

    return () => {
      document.documentElement.style.removeProperty("--module-accent");
    };
  }, [module?.accent]);

  if (loaderError) {
    return (
      <section className="route-fade py-8">
        <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4">
          <div className="card-head-md">
            <h1 className="detail-title-cyan">Module Content Error</h1>
            <p className="mt-3 text-slate-300">{loaderError.message}</p>
          </div>
          <Link to="/modules" className="base-card-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }

  if (!module) {
    return (
      <section className="route-fade py-8">
        <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4">
          <div className="card-head-md">
            <h1 className="detail-title-cyan">Module Not Found</h1>
          </div>
          <Link to="/modules" className="base-card-cta mt-2">
            Back to Module Index
          </Link>
        </article>
      </section>
    );
  }

  const Layout = layouts[module.moduleType] ?? ProcedureLayout;

  return (
    <section className="route-fade py-3">
      <Layout module={module} />
    </section>
  );
}
