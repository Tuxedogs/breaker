import WorkspacePanel from "../../shared/WorkspacePanel";
import type { ReactNode } from "react";
import type {
  HeroInspectView,
  ResourceSummaryView,
  ShipHeroAssetView,
  StatCardView,
  SystemsGroupView,
  TopBarView,
} from "../../../lib/fitting/mockup/fittingMockupViewTypes";
import FittingHero from "./FittingHero";
import FittingResourcesPanel from "./FittingResourcesPanel";
import FittingStatsGrid from "./FittingStatsGrid";
import FittingSystemsPanel from "./FittingSystemsPanel";
import FittingTopBar from "./FittingTopBar";
import FittingV31OfflinePreview from "./FittingV31OfflinePreview";
import "./fitting-mockup-shell.css";
import "./fitting-v31-layout.css";

type FittingMockupShellProps = {
  topBar: TopBarView;
  offensiveGroups: SystemsGroupView[];
  defensiveGroups: SystemsGroupView[];
  heroAsset: ShipHeroAssetView;
  heroInspect: HeroInspectView;
  statCards: StatCardView[];
  resourceSummary: ResourceSummaryView;
  offensiveEmptyMessage?: string;
  defensiveEmptyMessage?: string;
  errorMessage?: string | null;
  debugNode?: ReactNode;
  selectorDrawer?: ReactNode;
  selectedDetail?: ReactNode;
  onSelectShip: (shipKey: string) => void;
  onSelectOffensiveRow: (id: string) => void;
  onSelectDefensiveRow: (id: string) => void;
  onExitInspect: () => void;
  onViewHeroDetails: () => void;
  onStatCardAction?: (key: string) => void;
  onSaveLoadout?: () => void;
};

export default function FittingMockupShell({
  topBar,
  offensiveGroups,
  defensiveGroups,
  heroAsset,
  heroInspect,
  statCards,
  resourceSummary,
  offensiveEmptyMessage,
  defensiveEmptyMessage,
  errorMessage,
  debugNode,
  selectorDrawer,
  selectedDetail,
  onSelectShip,
  onSelectOffensiveRow,
  onSelectDefensiveRow,
  onExitInspect,
  onViewHeroDetails,
  onStatCardAction,
  onSaveLoadout,
}: FittingMockupShellProps) {
  // A clearly labeled visual reference only when local fixtures cannot load ship data.
  // The live Fitting API and all existing equipment interactions remain untouched.
  if (import.meta.env.MODE === "fixtures" && errorMessage) {
    return <FittingV31OfflinePreview />;
  }
  return (
    <main className="fm-shell fm-v31-shell" aria-label="Ship fitting overview">
      {errorMessage ? <div className="fm-error">{errorMessage}</div> : null}
      {debugNode}


      <WorkspacePanel as="section" tone="filter" className="fm-v31-offense-frame" aria-label="Offensive equipment">
        <FittingSystemsPanel
          className="fm-offense-panel"
          title="Offensive Systems"
          groups={offensiveGroups}
          emptyMessage={offensiveEmptyMessage}
          onSelectRow={onSelectOffensiveRow}
        />
      </WorkspacePanel>

      <WorkspacePanel as="section" tone="primary" className="fm-v31-hero-frame" aria-label="Selected ship">
        <FittingHero
          asset={heroAsset}
          inspect={heroInspect}
          onExitInspect={onExitInspect}
          onViewDetails={onViewHeroDetails}
          selectorDrawer={selectorDrawer}
          header={<FittingTopBar view={topBar} onSelectShip={onSelectShip} onSaveLoadout={onSaveLoadout} />}
        />
        {errorMessage ? <p className="fm-v31-source-state" role="status">{errorMessage} Component swapping requires the configured Fitting API.</p> : null}
      </WorkspacePanel>

      <WorkspacePanel as="div" tone="inspector" className="fm-right-col">
        <FittingSystemsPanel
          title="Defensive Systems"
          groups={defensiveGroups}
          emptyMessage={defensiveEmptyMessage}
          onSelectRow={onSelectDefensiveRow}
        />
        <FittingResourcesPanel summary={resourceSummary} selectedDetail={selectedDetail} />
      </WorkspacePanel>

      <FittingStatsGrid cards={statCards} onCardAction={onStatCardAction} />
    </main>
  );
}
