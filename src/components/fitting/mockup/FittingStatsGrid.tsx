import type { StatCardView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";
import FittingStatCard from "./FittingStatCard";

type FittingStatsGridProps = {
  cards: StatCardView[];
  onCardAction?: (key: string) => void;
};

export default function FittingStatsGrid({ cards, onCardAction }: FittingStatsGridProps) {
  return (
    <section className="fm-stats-grid" aria-label="Ship performance metrics">
      {cards.map((card) => (
        <FittingStatCard
          key={card.key}
          card={card}
          onAction={card.actionLabel && onCardAction ? () => onCardAction(card.key) : undefined}
        />
      ))}
    </section>
  );
}
