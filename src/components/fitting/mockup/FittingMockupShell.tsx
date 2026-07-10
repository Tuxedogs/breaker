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
import FittingRail from "./FittingRail";
import FittingResourcesPanel from "./FittingResourcesPanel";
import FittingStatsGrid from "./FittingStatsGrid";
import FittingSystemsPanel from "./FittingSystemsPanel";
import FittingTopBar from "./FittingTopBar";
import "./fitting-mockup-shell.css";

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
  return (
    <div className="fm-shell" role="application" aria-label="Ship fitting overview">
      <FittingTopBar view={topBar} onSelectShip={onSelectShip} onSaveLoadout={onSaveLoadout} />

      {errorMessage ? <div className="fm-error">{errorMessage}</div> : null}
      {debugNode}

      <div className="fm-body">
        <FittingRail />

        <FittingSystemsPanel
          title="Offensive Systems"
          groups={offensiveGroups}
          emptyMessage={offensiveEmptyMessage}
          onSelectRow={onSelectOffensiveRow}
        />

        <main className="fm-workspace">
          <FittingHero
            asset={heroAsset}
            inspect={heroInspect}
            onExitInspect={onExitInspect}
            onViewDetails={onViewHeroDetails}
            selectorDrawer={selectorDrawer}
          />
          <FittingStatsGrid cards={statCards} onCardAction={onStatCardAction} />
        </main>

        <div className="fm-right-col">
          <FittingSystemsPanel
            title="Defensive Systems"
            groups={defensiveGroups}
            emptyMessage={defensiveEmptyMessage}
            onSelectRow={onSelectDefensiveRow}
          />
          <FittingResourcesPanel summary={resourceSummary} selectedDetail={selectedDetail} />
        </div>
      </div>
    </div>
  );
}
