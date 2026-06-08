import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadMissionData,
  type BlueprintPoolLookup,
  type MissionContract,
  type MissionLookups,
  type MissionPrerequisite,
} from "@/lib/missionData";
import "./mission-browser.css";

const FAMILIES_PER_PAGE = 15;

type MissionFamily = {
  id: string;
  name: string;
  variants: MissionContract[];
  factions: string[];
  missionTypes: string[];
  statuses: string[];
  searchText: string;
};

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function readableName(value?: string): string {
  if (!value) return "Unknown mission family";
  return value
    .replace(/^ContractGenerator\./, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function missionStatuses(mission: MissionContract): string[] {
  const statuses = [truthy(mission.notForRelease) ? "not-for-release" : "unflagged"];
  if (truthy(mission.workInProgress)) statuses.push("work-in-progress");
  if (mission.classifications?.tutorial) statuses.push("tutorial");
  if (mission.classifications?.event) statuses.push("event");
  return statuses;
}

function statusLabel(status: string): string {
  return {
    "not-for-release": "Not for release",
    "work-in-progress": "Work in progress",
    unflagged: "Unflagged",
    tutorial: "Tutorial",
    event: "Event",
  }[status] ?? status;
}

function buildFamilies(records: MissionContract[], pools: Map<string, BlueprintPoolLookup>): MissionFamily[] {
  const grouped = new Map<string, MissionContract[]>();
  for (const mission of records) {
    const variants = grouped.get(mission.familyId) ?? [];
    variants.push(mission);
    grouped.set(mission.familyId, variants);
  }
  return Array.from(grouped.entries()).map(([id, variants]) => {
    variants.sort((a, b) => (a.title ?? a.debugName ?? "").localeCompare(b.title ?? b.debugName ?? ""));
    const representative = variants[0];
    const factions = Array.from(new Set(variants.map((item) => item.factionName).filter((value): value is string => Boolean(value)))).sort();
    const missionTypes = Array.from(new Set(variants.map((item) => item.missionType ?? item.contractType).filter((value): value is string => Boolean(value)))).sort();
    const statuses = Array.from(new Set(variants.flatMap(missionStatuses)));
    const rewardNames = variants.flatMap((mission) =>
      (mission.blueprintRewards ?? []).flatMap((reward) =>
        pools.get(reward.blueprintPoolGuid ?? "")?.rewards?.map((item) => item.displayName ?? item.blueprintGuid ?? "") ?? []
      )
    );
    const name = readableName(representative.handlerDebugName ?? representative.generatorName ?? representative.title);
    return {
      id,
      name,
      variants,
      factions,
      missionTypes,
      statuses,
      searchText: [
        name,
        ...factions,
        ...missionTypes,
        ...rewardNames,
        ...variants.flatMap((item) => [item.title, item.debugName, item.description, item.contractId]),
      ].filter(Boolean).join(" ").toLowerCase(),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function formatStanding(value?: { displayName?: string; minReputation?: number }): string {
  if (!value) return "Unknown";
  return [value.displayName, typeof value.minReputation === "number" ? `${value.minReputation.toLocaleString()} rep` : null]
    .filter(Boolean).join(" / ") || "Unknown";
}

type RequirementCategory = "Reputation" | "Standing / Rank" | "Location" | "Locality" | "Other Requirements";

type RequirementBadge = {
  category: RequirementCategory;
  identity: string;
  labels: string[];
  variantIds: Set<string>;
  recordCount: number;
  resolved: boolean;
};

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const display = String(value).trim();
  if (!display || GUID_PATTERN.test(display) || /^(undefined|null|nan)$/i.test(display)) return undefined;
  return display;
}

function recordValue(record: Record<string, unknown> | undefined, keys: string[]): unknown {
  for (const key of keys) {
    if (record?.[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
}

function numberValue(record: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  const value = recordValue(record, keys);
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatStandingRange(
  minName?: string,
  maxName?: string,
  minReputation?: number,
  maxReputation?: number,
): string {
  const min = [minName, minReputation !== undefined ? `${minReputation.toLocaleString()} rep` : null].filter(Boolean).join(" / ");
  const max = [maxName, maxReputation !== undefined ? `${maxReputation.toLocaleString()} rep` : null].filter(Boolean).join(" / ");
  if (min && max) return `${min} -> ${max}`;
  if (min) return `Requires ${min}`;
  if (max) return `Up to ${max}`;
  return "Standing requirement";
}

function prerequisiteCategory(type?: string): RequirementCategory {
  const normalized = type?.toLowerCase() ?? "";
  if (normalized.includes("reputation")) return "Reputation";
  if (normalized.includes("standing") || normalized.includes("rank")) return "Standing / Rank";
  if (normalized.includes("locality")) return "Locality";
  if (normalized.includes("location")) return "Location";
  return "Other Requirements";
}

function prerequisiteIdentity(item: MissionPrerequisite): string {
  const category = prerequisiteCategory(item.type);
  if (category === "Location" || category === "Locality") {
    return String(recordValue(item.resolved, ["displayName", "name", "locationDisplay", "localityDisplay"])
      ?? recordValue(item.attributes, ["locationAvailable", "localityAvailable", "location", "locality"])
      ?? category);
  }
  return JSON.stringify([item.type, item.resolved, item.attributes, item.references]);
}

function resolveMissionPlaceName(item: MissionPrerequisite): string | undefined {
  return asDisplayString(recordValue(item.resolved, [
    "displayName",
    "name",
    "locationDisplay",
    "localityDisplay",
    "locationName",
    "localityName",
    "address",
  ]));
}

function formatMissionPrerequisite(item: MissionPrerequisite, variantId: string): RequirementBadge {
  const category = prerequisiteCategory(item.type);
  const resolved = item.resolved;
  const attributes = item.attributes;

  if (category === "Reputation") {
    const faction = asDisplayString(recordValue(resolved, ["factionReputationDisplay", "factionDisplay", "factionName"]));
    const minName = asDisplayString(recordValue(resolved, ["minStandingDisplay", "minimumStandingDisplay", "minStanding"]));
    const maxName = asDisplayString(recordValue(resolved, ["maxStandingDisplay", "maximumStandingDisplay", "maxStanding"]));
    const minRep = numberValue(resolved, ["minReputation", "minimumReputation"])
      ?? numberValue(attributes, ["minReputation", "minimumReputation"]);
    const maxRep = numberValue(resolved, ["maxReputation", "maximumReputation"])
      ?? numberValue(attributes, ["maxReputation", "maximumReputation"]);
    return {
      category,
      identity: [faction, minName, maxName, minRep, maxRep].join("|"),
      labels: [faction, formatStandingRange(minName, maxName, minRep, maxRep)].filter((value): value is string => Boolean(value)),
      variantIds: new Set([variantId]),
      recordCount: 1,
      resolved: true,
    };
  }

  if (category === "Location" || category === "Locality") {
    const display = resolveMissionPlaceName(item);
    return {
      category,
      identity: prerequisiteIdentity(item),
      labels: [display ?? `${category} Required`],
      variantIds: new Set([variantId]),
      recordCount: 1,
      resolved: Boolean(display),
    };
  }

  const label = readableName(item.type)
    .replace(/^Contract Prerequisite\s*/i, "")
    .replace(/\s*Prerequisite$/i, "")
    .trim();
  return {
    category,
    identity: item.type ?? "other",
    labels: [`${label || "Other"} Required`],
    variantIds: new Set([variantId]),
    recordCount: 1,
    resolved: true,
  };
}

function groupMissionPrerequisites(missions: MissionContract[]): RequirementBadge[] {
  const grouped = new Map<string, RequirementBadge>();
  for (const mission of missions) {
    if (mission.minStanding || mission.maxStanding) {
      const label = formatStandingRange(
        mission.minStanding?.displayName,
        mission.maxStanding?.displayName,
        mission.minStanding?.minReputation,
        mission.maxStanding?.minReputation,
      );
      const standing: RequirementBadge = {
        category: "Standing / Rank",
        identity: label,
        labels: [label],
        variantIds: new Set([mission.contractId]),
        recordCount: 1,
        resolved: true,
      };
      const existing = grouped.get(`Standing / Rank|${label}`);
      if (existing) existing.variantIds.add(mission.contractId);
      else grouped.set(`Standing / Rank|${label}`, standing);
    }
    for (const prerequisite of mission.prerequisites ?? []) {
      const formatted = formatMissionPrerequisite(prerequisite, mission.contractId);
      const key = `${formatted.category}|${formatted.identity}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.variantIds.add(mission.contractId);
        existing.recordCount += 1;
      } else {
        grouped.set(key, formatted);
      }
    }
  }
  return Array.from(grouped.values());
}

function MissionRequirementBadges({ missions, familySummary = false, compact = false }: { missions: MissionContract[]; familySummary?: boolean; compact?: boolean }) {
  const requirements = groupMissionPrerequisites(missions);
  if (!requirements.length) return <p className="mb-empty-note">No extracted prerequisites.</p>;

  const categories: RequirementCategory[] = ["Reputation", "Standing / Rank", "Location", "Locality", "Other Requirements"];
  return (
    <div className="mb-requirement-groups">
      {categories.map((category) => {
        const items = requirements.filter((item) => item.category === category);
        if (!items.length) return null;
        const isPlace = category === "Location" || category === "Locality";
        const resolvedPlaceNames = Array.from(new Set(items.flatMap((item) => item.resolved ? item.labels : [])));
        const placeLabels = [
          ...resolvedPlaceNames.slice(0, 4),
          ...(resolvedPlaceNames.length > 4 ? [`+${resolvedPlaceNames.length - 4} more`] : []),
          ...(items.some((item) => !item.resolved) ? [`${category} Required`] : []),
          ...(familySummary && items.length > 1 ? [`x${items.length} unique`] : []),
          ...(familySummary && items.length === 1 && items[0].variantIds.size > 1 ? [`x${items[0].variantIds.size} variants`] : []),
          ...(familySummary && resolvedPlaceNames.length > 0 && items.length > resolvedPlaceNames.length ? [`x${items.length} records`] : []),
        ];
        const labels = isPlace
          ? placeLabels
          : items.flatMap((item) => [
            ...item.labels,
            ...(familySummary && item.variantIds.size > 1 ? [`x${item.variantIds.size} variants`] : []),
          ]);
        return (
          <div className={`mb-requirement-group${compact ? " is-compact" : ""}`} key={category}>
            <strong>{category}</strong>
            <div className="mb-badges">{Array.from(new Set(labels)).map((label) => <span className="mb-badge is-requirement" key={label}>{label}</span>)}</div>
            {isPlace && items.every((item) => !item.resolved) && <small>{category} name unavailable</small>}
          </div>
        );
      })}
    </div>
  );
}

function rewardBadges(mission: MissionContract, pools: Map<string, BlueprintPoolLookup>): string[] {
  const badges: string[] = [];
  for (const reward of mission.blueprintRewards ?? []) {
    const pool = pools.get(reward.blueprintPoolGuid ?? "");
    badges.push(`Blueprint: ${pool?.displayName ?? pool?.poolName ?? "Unknown pool"}`);
  }
  for (const reward of mission.itemRewards ?? []) {
    const amount = asDisplayString(recordValue(reward.attributes, ["amount", "quantity"]));
    badges.push(amount ? `Item x${amount}` : "Item reward");
  }
  for (const reward of mission.reputationRewards ?? []) {
    const amount = reward.reputationAmount ?? numberValue(reward.reward, ["reputationAmount"]);
    badges.push(amount !== undefined ? `Reputation ${amount >= 0 ? "+" : ""}${amount.toLocaleString()}` : "Reputation unavailable");
  }
  if (mission.creditRewardTypes?.length) badges.push("Credits unavailable");
  if (mission.completionTags?.length) badges.push("Completion tag");
  return Array.from(new Set(badges));
}

function RewardSection({ mission, pools }: { mission: MissionContract; pools: Map<string, BlueprintPoolLookup> }) {
  const badges = rewardBadges(mission, pools);
  if (!badges.length) return <p className="mb-empty-note">No extracted rewards.</p>;
  return (
    <div className="mb-badges">{badges.map((label) => <span className="mb-badge is-reward" key={label}>{label}</span>)}</div>
  );
}

function familyRewardBadges(missions: MissionContract[], pools: Map<string, BlueprintPoolLookup>): string[] {
  return Array.from(new Set(missions.flatMap((mission) => rewardBadges(mission, pools))));
}

function cleanDescription(description?: string): string {
  return description?.replace(/\\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() ?? "";
}

function placeSummary(mission: MissionContract): string {
  const requirements = groupMissionPrerequisites([mission]).filter((item) => item.category === "Location" || item.category === "Locality");
  const labels = Array.from(new Set(requirements.flatMap((item) => item.labels)));
  return labels.slice(0, 2).join(", ") || "None";
}

export default function MissionBrowserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<MissionContract[]>([]);
  const [lookups, setLookups] = useState<MissionLookups>({});
  const [metadata, setMetadata] = useState<{ generatedAt: string; sourceLatestModifiedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadMissionData()
      .then(({ catalog, lookups: dataLookups }) => {
        if (cancelled) return;
        setRecords(catalog.records);
        setMetadata({ generatedAt: catalog.generatedAt, sourceLatestModifiedAt: catalog.sourceLatestModifiedAt });
        setLookups(dataLookups);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Mission catalog unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const pools = useMemo(() => new Map((lookups.blueprintPools ?? []).map((pool) => [pool.poolGuid ?? "", pool])), [lookups]);
  const families = useMemo(() => buildFamilies(records, pools), [records, pools]);
  const query = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const faction = searchParams.get("faction") ?? "";
  const missionType = searchParams.get("type") ?? "";
  const contractType = searchParams.get("contract") ?? "";
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const selectedId = searchParams.get("family");
  const selectedFamily = families.find((family) => family.id === selectedId) ?? null;
  const selectedDescription = cleanDescription(selectedFamily?.variants.find((mission) => mission.description)?.description);

  const factions = useMemo(() => Array.from(new Set(records.map((item) => item.factionName).filter((value): value is string => Boolean(value)))).sort(), [records]);
  const missionTypes = useMemo(() => Array.from(new Set(records.map((item) => item.missionType).filter((value): value is string => Boolean(value)))).sort(), [records]);
  const contractTypes = useMemo(() => Array.from(new Set(records.map((item) => item.contractType).filter((value): value is string => Boolean(value)))).sort(), [records]);
  const visibleFamilies = families.filter((family) => {
    if (query.trim() && !family.searchText.includes(query.trim().toLowerCase())) return false;
    if (status && !family.variants.some((item) => missionStatuses(item).includes(status))) return false;
    if (faction && !family.variants.some((item) => item.factionName === faction)) return false;
    if (missionType && !family.variants.some((item) => item.missionType === missionType)) return false;
    if (contractType && !family.variants.some((item) => item.contractType === contractType)) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(visibleFamilies.length / FAMILIES_PER_PAGE));
  const currentPage = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const pageStart = (currentPage - 1) * FAMILIES_PER_PAGE;
  const pagedFamilies = visibleFamilies.slice(pageStart, pageStart + FAMILIES_PER_PAGE);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "family") next.delete("family");
    if (key !== "page" && key !== "family") next.delete("page");
    setShowAllVariants(false);
    setExpandedDescriptions(new Set());
    setSearchParams(next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete("page"); else next.set("page", String(page));
    next.delete("family");
    setShowAllVariants(false);
    setExpandedDescriptions(new Set());
    setSearchParams(next);
  }

  function toggleDescription(id: string) {
    setExpandedDescriptions((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="mb-page">
      <div className="mb-shell">
        <header className="mb-header">
          <div><span className="mb-kicker">Industry Intelligence</span><h1>Mission Browser</h1></div>
          <div className="mb-summary"><strong>{records.length.toLocaleString()}</strong><span>contracts</span><strong>{families.length}</strong><span>families</span></div>
        </header>
        <p className="mb-source-note">Read-only extracted contract records. Unflagged does not guarantee current in-game availability.{metadata ? ` Source updated ${new Date(metadata.sourceLatestModifiedAt).toLocaleDateString()}.` : ""}</p>
        <section className="mb-controls" aria-label="Mission browser filters">
          <input type="search" value={query} onChange={(event) => setParam("search", event.target.value)} placeholder="Search missions, factions, debug names, rewards..." />
          <select value={status} onChange={(event) => setParam("status", event.target.value)}><option value="">All statuses</option>{["unflagged", "not-for-release", "work-in-progress", "tutorial", "event"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
          <select value={faction} onChange={(event) => setParam("faction", event.target.value)}><option value="">All factions</option>{factions.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={missionType} onChange={(event) => setParam("type", event.target.value)}><option value="">All mission types</option>{missionTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={contractType} onChange={(event) => setParam("contract", event.target.value)}><option value="">All contract types</option>{contractTypes.map((item) => <option key={item}>{item}</option>)}</select>
        </section>
        {loading && <div className="mb-state">Loading mission catalog...</div>}
        {error && <div className="mb-state is-error">{error}</div>}
        {!loading && !error && (
          <div className="mb-workspace">
            <main className="mb-family-list">
              <div className="mb-result-count">
                {visibleFamilies.length} families / {visibleFamilies.reduce((sum, item) => sum + item.variants.length, 0)} contracts
                {visibleFamilies.length > 0 && <span>Showing {pageStart + 1}-{Math.min(pageStart + FAMILIES_PER_PAGE, visibleFamilies.length)}</span>}
              </div>
              {pagedFamilies.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  className={`mb-family-row${selectedFamily?.id === family.id ? " is-selected" : ""}`}
                  aria-expanded={selectedFamily?.id === family.id}
                  aria-controls="mission-family-detail"
                  onClick={() => setParam("family", selectedFamily?.id === family.id ? "" : family.id)}
                >
                  <span className="mb-family-copy"><strong>{family.name}</strong><small>{family.factions.join(", ") || "Unknown faction"} / {family.missionTypes.join(", ") || "Unknown type"}</small></span>
                  <span className="mb-family-statuses">{family.statuses.map((item) => <i className={`is-${item}`} key={item}>{statusLabel(item)}</i>)}</span>
                  <span className="mb-family-count"><strong>{family.variants.length}</strong><small>variants</small></span>
                </button>
              ))}
              {visibleFamilies.length > 0 && (
                <footer className="mb-pagination" aria-label="Mission family pages">
                  <span>Page {currentPage} of {pageCount}</span>
                  <nav>
                    <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={page === currentPage ? "is-active" : ""}
                        aria-current={page === currentPage ? "page" : undefined}
                        onClick={() => setPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
                  </nav>
                </footer>
              )}
            </main>
            {selectedFamily && (
              <section className="mb-detail" id="mission-family-detail" aria-label={`${selectedFamily.name} mission family details`}>
                <header>
                  <div>
                    <span>Mission Family</span>
                    <h2>{selectedFamily.name}</h2>
                    <p>{selectedFamily.factions.join(", ") || "Unknown faction"} / {Array.from(new Set(selectedFamily.variants.map((item) => item.contractType).filter(Boolean))).join(", ") || "Unknown contract type"} / {selectedFamily.variants.length} extracted contract variants</p>
                    <div className="mb-badges">
                      {selectedFamily.factions.map((item) => <i className="mb-badge is-neutral" key={item}>{item}</i>)}
                      {Array.from(new Set(selectedFamily.variants.map((item) => item.contractType).filter((item): item is string => Boolean(item)))).map((item) => <i className="mb-badge is-neutral" key={item}>{item}</i>)}
                      {selectedFamily.statuses.map((item) => <i className={`mb-badge is-${item}`} key={item}>{statusLabel(item)}</i>)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setParam("family", "")}>Collapse</button>
                </header>
                <div className="mb-summary-strip">
                  <MissionRequirementBadges missions={selectedFamily.variants} familySummary compact />
                  <div className="mb-requirement-group is-compact">
                    <strong>Rewards</strong>
                    <div className="mb-badges">
                      {familyRewardBadges(selectedFamily.variants, pools).map((label) => <span className="mb-badge is-reward" key={label}>{label}</span>)}
                    </div>
                  </div>
                </div>
                {selectedDescription && (
                  <section className="mb-description">
                    <div className="mb-section-heading"><strong>Description</strong></div>
                    <p className={expandedDescriptions.has(selectedFamily.id) ? "is-expanded" : ""}>{selectedDescription}</p>
                    <button type="button" onClick={() => toggleDescription(selectedFamily.id)}>
                      {expandedDescriptions.has(selectedFamily.id) ? "Collapse Description" : "Expand Description"}
                    </button>
                  </section>
                )}
                <section className="mb-family-requirements">
                  <div className="mb-section-heading"><strong>Requirement Details</strong></div>
                  <MissionRequirementBadges missions={selectedFamily.variants} familySummary />
                </section>
                <div className="mb-section-heading"><strong>Contract Variants</strong><span>{selectedFamily.variants.length}</span></div>
                <div className="mb-variant-columns" aria-hidden="true">
                  <span>Contract Title</span><span>Mission Type</span><span>Standing</span><span>Location / Locality</span><span>Rewards</span><span>Status</span><span>Expand</span>
                </div>
                <div className="mb-variant-list">
                  {(showAllVariants ? selectedFamily.variants : selectedFamily.variants.slice(0, 8)).map((mission) => (
                    <details key={mission.contractId} className="mb-variant">
                      <summary>
                        <strong>{mission.title ?? mission.debugName ?? "Unknown mission"}</strong>
                        <span>{mission.missionType ?? "Unknown"}</span>
                        <span>{formatStandingRange(mission.minStanding?.displayName, mission.maxStanding?.displayName, mission.minStanding?.minReputation, mission.maxStanding?.minReputation)}</span>
                        <span>{placeSummary(mission)}</span>
                        <span>{rewardBadges(mission, pools).slice(0, 2).join(", ") || "None"}</span>
                        <span className="mb-family-statuses">{missionStatuses(mission).map((item) => <i className={`is-${item}`} key={item}>{statusLabel(item)}</i>)}</span>
                        <span className="mb-expand-label">Details</span>
                      </summary>
                      <div className="mb-variant-body">
                        {mission.description && (
                          <section className="mb-description is-variant">
                            <h3>Description</h3>
                            <p className={expandedDescriptions.has(mission.contractId) ? "is-expanded" : ""}>{cleanDescription(mission.description)}</p>
                            <button type="button" onClick={() => toggleDescription(mission.contractId)}>
                              {expandedDescriptions.has(mission.contractId) ? "Collapse Description" : "Expand Description"}
                            </button>
                          </section>
                        )}
                        <dl>
                          <div><dt>Organization / Faction</dt><dd>{mission.factionName ?? "Unknown"}</dd></div>
                          <div><dt>Contract Type</dt><dd>{mission.contractType ?? "Unknown"}</dd></div>
                          <div><dt>Mission Type</dt><dd>{mission.missionType ?? "Unknown"}</dd></div>
                          <div><dt>Minimum Standing</dt><dd>{formatStanding(mission.minStanding)}</dd></div>
                          <div><dt>Maximum Standing</dt><dd>{formatStanding(mission.maxStanding)}</dd></div>
                        </dl>
                        <section><h3>Requirements</h3><MissionRequirementBadges missions={[mission]} /></section>
                        <section><h3>Rewards</h3><RewardSection mission={mission} pools={pools} /></section>
                      </div>
                    </details>
                  ))}
                </div>
                {selectedFamily.variants.length > 8 && (
                  <button className="mb-view-all" type="button" onClick={() => setShowAllVariants((current) => !current)}>
                    {showAllVariants ? "Show Fewer Variants" : `View All ${selectedFamily.variants.length} Variants`}
                  </button>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
