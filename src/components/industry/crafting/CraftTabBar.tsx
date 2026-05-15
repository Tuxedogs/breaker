import { useNavigate } from "react-router-dom";
import "./craft-tab-bar.css";

type Tab = "recipes" | "queue" | "analytics" | "quality" | "mining";

const TABS: { id: Tab; label: string }[] = [
  { id: "recipes", label: "Recipe Browser" },
  { id: "queue", label: "Build Queue" },
  { id: "mining", label: "Mining" },
  { id: "analytics", label: "Demand Analytics" },
  { id: "quality", label: "Quality Modifiers" },
];

interface Props {
  activeTab: Tab;
  onTabChange?: (tab: Tab) => void;
  queueBadge?: number | null;
  missingCount?: number;
}

export default function CraftTabBar({ activeTab, onTabChange, queueBadge, missingCount = 0 }: Props) {
  const navigate = useNavigate();

  function handleClick(id: Tab) {
    if (id === activeTab) return;
    if (id === "queue") {
      navigate("/logistics/build-queue");
    } else if (id === "mining") {
      navigate("/industry/mining");
    } else if (activeTab === "queue" || activeTab === "mining") {
      navigate("/industry/crafting");
    } else {
      onTabChange?.(id);
    }
  }

  return (
    <div className="craft-tab-bar">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`craft-tab${activeTab === id ? " craft-tab--active" : ""}`}
          onClick={() => handleClick(id)}
        >
          {label}
          {id === "queue" && queueBadge != null && (
            <span className="craft-tab-badge">{queueBadge}</span>
          )}
          {id === "queue" && missingCount > 0 && (
            <span className="craft-tab-badge craft-tab-badge--alert">{missingCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
