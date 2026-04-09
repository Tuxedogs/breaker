import type { DoctrineModule } from "../../data/modules";

export function FrameworkLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--framework space-y-2">
      {/* Hero */}
      <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Decision Framework</p>
            <h1 className="doctrine-hero-title">{module.title}</h1>
            {module.summary ? (
              <p className="doctrine-hero-summary">{module.summary}</p>
            ) : null}
          </div>
          <div className="doctrine-meta-row">
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Status</span>
              <span className="doctrine-meta-value">{module.status}</span>
            </div>
            {module.validatedDate ? (
              <div className="doctrine-meta-item">
                <span className="doctrine-meta-label">Validated</span>
                <span className="doctrine-meta-value">{module.validatedDate}</span>
              </div>
            ) : null}
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Owner</span>
              <span className="doctrine-meta-value">{module.owner}</span>
            </div>
          </div>
        </header>
      </article>

      {/* Decision question + criteria */}
      <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
        {module.question ? (
          <p className="doctrine-framework-question">{module.question}</p>
        ) : null}

        {module.criteria && module.criteria.length > 0 ? (
          <section>
            <p className="doctrine-framework-section-label">Scoring Criteria</p>
            <ul className="doctrine-criteria-list">
              {module.criteria.map((item, i) => (
                <li key={i} className="doctrine-criteria-item">
                  <span
                    className={[
                      "doctrine-criteria-weight",
                      item.weight
                        ? `doctrine-criteria-weight--${item.weight}`
                        : "doctrine-criteria-weight--none",
                    ].join(" ")}
                  >
                    {item.weight ?? ""}
                  </span>
                  <div className="doctrine-criteria-body">
                    <span className="doctrine-criteria-label">{item.label}</span>
                    <p className="doctrine-criteria-description">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      {/* Decision matrix */}
      {module.matrix && module.matrix.length > 0 ? (
        <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
          <p className="doctrine-framework-section-label">Decision Matrix</p>
          <table className="doctrine-matrix">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {module.matrix.map((row, i) => (
                <tr key={i}>
                  <td className="doctrine-matrix-condition">{row.condition}</td>
                  <td className="doctrine-matrix-action">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      {/* Output + failure modes */}
      {((module.output && module.output.length > 0) ||
        (module.failureModes && module.failureModes.length > 0)) ? (
        <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            {module.output && module.output.length > 0 ? (
              <section>
                <p className="doctrine-framework-section-label">Outputs</p>
                <ul className="doctrine-output-list">
                  {module.output.map((item, i) => (
                    <li key={i} className="doctrine-output-item">
                      <span className="doctrine-output-label">{item.label}</span>
                      <p className="doctrine-output-description">{item.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {module.failureModes && module.failureModes.length > 0 ? (
              <section>
                <p className="doctrine-framework-section-label">Failure Modes</p>
                <ul className="doctrine-brief-list">
                  {module.failureModes.map((item, i) => (
                    <li key={i} className="doctrine-brief-item">
                      <span className="doctrine-brief-title">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </article>
      ) : null}

      {/* MDX body prose */}
      <article className="base-card base-card--systems base-card--compact rounded-[1.5rem] p-4 sm:p-6">
        <div className="doctrine-framework-prose">
          <module.Content />
        </div>
      </article>
    </div>
  );
}
