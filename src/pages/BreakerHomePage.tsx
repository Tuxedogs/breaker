import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import BreakerTopBar from "../components/dashboard/BreakerTopBar";
import { PRIMARY_MODULES } from "../components/dashboard/shellNavigation";
import "../components/dashboard/breaker-shell.css";
import "../styles/breaker-home.css";

/**
 * Breaker's navigational homepage, composed directly from the approved
 * V31 mockup. Operational modules remain their existing real React pages.
 * Module labels, glyphs and routes come from the shared shell navigation.
 */
const slices = [
  {
    key: "mine",
    number: "01 / 05",
    accent: "var(--mb-accent)",
    kicker: "RESOURCE INTELLIGENCE",
    description: "Find the right material. Compare locations. Plan the extraction.",
    cta: "Open mining",
  },
  {
    key: "craft",
    number: "02 / 05",
    accent: "var(--mb-shell-topbar-craft-accent)",
    kicker: "FABRICATION SYSTEMS",
    description: "Turn materials into components. Control quality and requirements.",
    cta: "Open workspace",
  },
  {
    key: "build",
    number: "03 / 05",
    accent: "var(--mb-shell-topbar-build-accent)",
    kicker: "PRODUCTION PIPELINE",
    description: "Plan the next build. See blockers and materials at a glance.",
    cta: "Open workspace",
  },
  {
    key: "inventory",
    number: "04 / 05",
    accent: "var(--mb-shell-topbar-inventory-accent)",
    kicker: "WAREHOUSE OPERATIONS",
    description: "Find and manage items across every location.",
    cta: "Open workspace",
  },
] as const;

function shellModule(key: string) {
  const module = PRIMARY_MODULES.find((entry) => entry.key === key);
  if (!module) throw new Error(`Unknown Breaker module: ${key}`);
  return module;
}

const fitting = shellModule("fitting");

export default function BreakerHomePage() {
  const [showInfo, setShowInfo] = useState(false);
  const fixture = import.meta.env.MODE === "fixtures";

  return (
    <div className="breaker-home">
      <BreakerTopBar
        home={{
          status: fixture ? "BUILD / DEMO FIXTURE" : "BREAKER / WORKSPACE",
          statusTitle: fixture ? "Fixture data, network disabled" : "Breaker application",
          action: (
            <>
              <button
                className="breaker-topbar__round"
                type="button"
                aria-label="About this homepage"
                aria-expanded={showInfo}
                onClick={() => setShowInfo((open) => !open)}
              >
                ○
              </button>
              {showInfo && (
                <div className="top-info" role="status">
                  Select a workspace to open Breaker's existing tools. Fitting is still under development.
                </div>
              )}
            </>
          ),
        }}
      />

      <main id="home" aria-label="Breaker workspaces">
        <div className="responsive-home-heading">
          <strong>YOUR WORKSPACES</strong>
          <small>{fixture ? "5 MODULES · INTERACTIVE DEMO" : "5 MODULES"}</small>
        </div>
        <nav className="slices" aria-label="Choose a workspace">
          {slices.map((slice) => {
            const module = shellModule(slice.key);
            const name = module.label.toUpperCase();
            return (
              <Link
                key={slice.key}
                className="slice"
                data-name={slice.key}
                to={module.to}
                viewTransition
                style={{ "--accent": slice.accent } as CSSProperties}
                aria-label={"Open " + name + ": " + slice.description}
              >
                <span className="slice-art" aria-hidden="true" />
                <span className="slice-number">{slice.number}</span>
                <div className="slice-copy">
                  <div className="slice-kicker">{slice.kicker}</div>
                  <div className="slice-glyph" aria-hidden="true">{module.glyph}</div>
                  <h2>{name}</h2>
                  <p className="slice-desc">{slice.description}</p>
                  <div className="slice-line" aria-hidden="true" />
                  <div className="slice-enter">
                    <i aria-hidden="true">→</i> {slice.cta}
                  </div>
                </div>
              </Link>
            );
          })}
          <section
            className="slice slice--unavailable"
            data-name="fitting"
            style={{ "--accent": "var(--mb-home-slice-unavailable-accent)" } as CSSProperties}
            aria-label="Fitting workspace is under development"
            aria-disabled="true"
            title="Fitting is under development"
          >
            <span className="slice-art" aria-hidden="true" />
            <span className="slice-number">05 / 05</span>
            <div className="slice-copy">
              <div className="slice-kicker">SHIP ENGINEERING</div>
              <div className="slice-glyph" aria-hidden="true">{fitting.glyph}</div>
              <h2>{fitting.label.toUpperCase()}</h2>
              <p className="slice-desc">Configure loadouts and engineering systems.</p>
              <div className="slice-line" aria-hidden="true" />
              <div className="slice-wip" aria-hidden="true">OPEN FITTING ↗</div>
            </div>
          </section>
        </nav>
      </main>
    </div>
  );
}
