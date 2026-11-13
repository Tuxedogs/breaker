import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCategoryIconUrl } from "@/lib/componentCategoryIcon";
import { resolveComponentImageUrl } from "@/lib/componentImageResolver";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "../utils/componentCardVariants";
import {
  filterRecipeBrowserRecords,
  compareRecipeBrowserRecords,
  compareRecipeBrowserSearchRecords,
  getRecipeBrowserSearchParam,
  pickPreferredRecipeBrowserSearchRecord,
} from "../utils/recipeBrowserFilters";
import {
  getRecipeBrowserColumnWidth,
  getRecipeBrowserFamily,
  titleCase,
  type RecipeBrowserColumn,
  type RecipeBrowserFamily,
} from "../utils/recipeBrowserPresentation";
import GradeClassText from "./GradeClassText";
import { classToneClass, gradeToneClass } from "../utils/componentGradeClass";
import type { CraftingBrowserLayoutMode } from "../utils/craftingBrowserLayout";

const SAVED_BLUEPRINT_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
function readStoredStringSet(key: string): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function RecipeComponentThumbnail({ imageUrl }: { imageUrl: string | null }) {
  // Never substitute a generic category icon for a component's own render.
  // An unmapped or failed image keeps the reference's blueprint glyph.
  const [failed, setFailed] = useState(false);
  return (
    <span className="craft-v31-recipe-mark" aria-hidden="true">
      {imageUrl && !failed
        ? <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <span className="craft-v31-recipe-symbol">▧</span>}
    </span>
  );
}

function ComponentBrowserState({ title, body }: { title: string; body: string }) {
  return (
    <section className="crb2-browser-state">
      <span>{title}</span>
      <p>{body}</p>
    </section>
  );
}



 


function RecipeResultsTable({
  family,
  records,
  selectedId,
  onSelect,
  layoutMode,
}: {
  family: RecipeBrowserFamily;
  records: ComponentCardIndexRecord[];
  selectedId: string;
  onSelect: (record: ComponentCardIndexRecord) => void;
  layoutMode: CraftingBrowserLayoutMode;
}) {
  type SortState = { key: string; direction: "ascending" | "descending" };
  const [sort, setSort] = useState<SortState | null>(null);
  const columns = layoutMode === "compact-split" ? family.compactColumns : family.columns;

  const compareValues = (
    a: ComponentCardIndexRecord,
    b: ComponentCardIndexRecord,
    column?: RecipeBrowserColumn,
  ) => {
    const rawA = column?.sortValue?.(a) ?? column?.value(a) ?? a.name;
    const rawB = column?.sortValue?.(b) ?? column?.value(b) ?? b.name;
    const missingA = rawA === null || rawA === undefined || rawA === "—";
    const missingB = rawB === null || rawB === undefined || rawB === "—";
    if (missingA !== missingB) return missingA ? 1 : -1;

    const numeric = (value: number | string | null | undefined) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const parsed = Number(String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const numberA = numeric(rawA);
    const numberB = numeric(rawB);
    if (numberA !== null && numberB !== null) return numberA - numberB;
    return String(rawA ?? "").localeCompare(String(rawB ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const sortedRecords = useMemo(() => {
    if (!sort) return records;
    const column = columns.find((item) => item.key === sort.key);
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...records].sort((a, b) => {
      const compared = sort.key === "component"
        ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        : compareValues(a, b, column);
      return compared * direction;
    });
  }, [columns, records, sort]);
  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "descending" ? "ascending" : "descending",
        };
      }
      return { key, direction: key === "component" ? "ascending" : "descending" };
    });
  };

  const sortHeader = (key: string, label: string) => {
    const active = sort?.key === key;
    return (
      <button
        type="button"
        className={active ? "crb2-sort-button crb2-sort-button--active" : "crb2-sort-button"}
        onClick={() => toggleSort(key)}
      >
        <span>{label}</span>
        <span aria-hidden="true">{active ? (sort.direction === "descending" ? "↓" : "↑") : "↕"}</span>
      </button>
    );
  };

  const onRowKeyboard = (
    event: KeyboardEvent<HTMLTableRowElement>,
    record: ComponentCardIndexRecord,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelect(record);
    } else if (event.key === " ") {
      event.preventDefault();
      onSelect(record);
    }
  };

  return (
    <section className="crb2-table-section" aria-labelledby={`crb2-family-${family.key}`}>
      <header>
        <h3 id={`crb2-family-${family.key}`}>{family.label}</h3>
        <span>{records.length} blueprints</span>
      </header>
      <div className="crb2-table-scroll">
        <table className={`crb2-table${layoutMode === "compact-split" ? " crb2-table--compact" : ""}`}>
          <colgroup>
            <col className="crb2-table-column--component" />
            {columns.map((column) => {
              const width = layoutMode === "compact-split" ? column.width : getRecipeBrowserColumnWidth(column);
              return <col key={column.key} style={width ? { width } : undefined} />;
            })}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-sort={sort?.key === "component" ? sort.direction : "none"}>
                {sortHeader("component", "Component")}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort?.key === column.key ? sort.direction : "none"}
                >
                  {sortHeader(column.key, column.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => {
              const selected = record.id === selectedId;
              return (
                <tr
                  key={record.id}
                  className={selected ? "crb2-table-row--selected" : undefined}
                  data-crafting-record-id={record.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(record)}
                  onDoubleClick={() => onSelect(record)}
                  onKeyDown={(event) => onRowKeyboard(event, record)}
                >
                  <th scope="row">
                    <span className="crb2-row-name" title={record.name}>{record.name}</span>
                  </th>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "gradeClass" ? (
                        <GradeClassText parts={[
                          record.grade ? { text: record.grade, tone: gradeToneClass(record.grade) } : null,
                          record.class ? { text: titleCase(record.class), tone: classToneClass(record.class) } : null,
                        ]} />
                      ) : column.value(record)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="crb2-mobile-results">
        <div className="crb2-mobile-results-head">
          <span>{records.length} components</span>
          <button type="button" onClick={() => toggleSort("component")}>
            Sort: Name <span aria-hidden="true">{sort?.key === "component" && sort.direction === "descending" ? "↑" : "↓"}</span>
          </button>
        </div>
        <div className="crb2-mobile-card-list">
          {sortedRecords.map((record) => {
            const iconUrl = getComponentCategoryIconUrl(record);
            const classification = [
              record.size !== null ? { text: `S${record.size}`, tone: "" } : null,
              record.grade ? { text: `Grade ${record.grade}`, tone: gradeToneClass(record.grade) } : null,
              record.class ? { text: titleCase(record.class), tone: classToneClass(record.class) } : null,
            ].filter(Boolean);
            return (
              <button
                key={record.id}
                type="button"
                className="crb2-mobile-card crafting-catalog-card"
                data-crafting-record-id={record.id}
                onClick={() => onSelect(record)}
              >
                <span className="crb2-mobile-card-art crafting-component-art">
                  {iconUrl ? <img src={iconUrl} alt="" aria-hidden="true" /> : <span aria-hidden="true" />}
                </span>
                <span className="crb2-mobile-card-copy crafting-identity-copy">
                  <strong className="crafting-item-name">{record.name}</strong>
                  <span className="crb2-mobile-card-type crafting-family-label">{record.typeLabel}</span>
                  {classification.length ? <small className="crafting-meta-line"><GradeClassText parts={classification} /></small> : null}
                </span>
                <span className="crb2-mobile-card-chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ComponentResultsBrowser({
  records,
  loading,
  error,
  previewId,
  onPreviewRecord,
  autoSelectFirstRecord = true,
  presentation = "table",
  isRecipeQueued,
  isBlueprintSourceVerified,
  isBlueprintUnavailable,
  layoutMode,
  serverPage,
}: {
  records: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (record: ComponentCardIndexRecord) => boolean;
  previewId?: string | null;
  onPreviewRecord?: (record: ComponentCardIndexRecord) => void;
  autoSelectFirstRecord?: boolean;
  isBlueprintSourceVerified?: (record: ComponentCardIndexRecord) => boolean | null;
  /** True when every known blueprint source is disabled in the current release. */
  isBlueprintUnavailable?: (record: ComponentCardIndexRecord) => boolean;
  presentation?: "table" | "index";
  layoutMode: CraftingBrowserLayoutMode;
  serverPage?: { totalRecords: number; page: number; limit: number } | null;
}) {
  const [searchParams] = useSearchParams();
  const savedOnly = searchParams.get("bk") === "1";
  const selectedMaterialIds = new Set((searchParams.get("mt") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const materialMatchMode = searchParams.get("mm") === "any" ? "any" : "all";
  const search = getRecipeBrowserSearchParam(searchParams);

  const [savedBlueprintIds, setSavedBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(SAVED_BLUEPRINT_STORAGE_KEY),
  );
  const [selectedId, setSelectedId] = useState("");
  const lastPreviewIdRef = useRef<string | null>(previewId ?? null);
  const { session } = useAuthSession();

  useEffect(() => {
    const previousPreviewId = lastPreviewIdRef.current;
    lastPreviewIdRef.current = previewId ?? null;
    if (!previousPreviewId || previewId) return;

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-crafting-record-id="${CSS.escape(previousPreviewId)}"]`,
      );
      row?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [previewId]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((saved) => {
        if (!cancelled) setSavedBlueprintIds(new Set(saved.map((item) => item.blueprintId)));
      })
      .catch(() => {
        if (!cancelled) setSavedBlueprintIds(new Set());
      });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const filteredRecords = useMemo(
    () => filterRecipeBrowserRecords(records, searchParams, {
      savedOnly,
      savedBlueprintIds,
    }),
    [records, savedBlueprintIds, savedOnly, searchParams],
  );

  const { groupedRecords,  } = useMemo(() => {
    if (serverPage) return { groupedRecords: records };
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];
    for (const record of filteredRecords) {
      const key = getComponentCardVariantGroupKey(record);
      if (!key) {
        ungrouped.push(record);
        continue;
      }
      const members = groups.get(key);
      if (members) members.push(record);
      else groups.set(key, [record]);
    }

    const grouped = [...ungrouped];
    const counts = new Map<string, number>();
    for (const members of groups.values()) {
      const representative = pickComponentCardGroupRepresentative(members);
      grouped.push(representative);
      if (members.length > 1) counts.set(representative.id, members.length);
    }
    grouped.sort(search
      ? (a, b) => compareRecipeBrowserSearchRecords(a, b, search)
      : compareRecipeBrowserRecords);
    return { groupedRecords: grouped };
  }, [filteredRecords, records, search, serverPage]);

  
  // The whole filtered list is shown; there is no paging.
  const pageRecords = groupedRecords;

  const selectedCandidate = pageRecords.find((record) => record.id === (previewId ?? selectedId));
  const preferredRecord = pickPreferredRecipeBrowserSearchRecord(pageRecords, search);
  const shouldPreferWeapon = Boolean(
    search
    && selectedCandidate?.type === "ammo"
    && preferredRecord?.kind === "fps"
    && preferredRecord.type === "weapons",
  );
  const selectedRecord = autoSelectFirstRecord
    ? (!selectedCandidate || shouldPreferWeapon
      ? preferredRecord ?? pageRecords[0]
      : selectedCandidate)
    : selectedCandidate;

  const tableGroups = useMemo(() => {
    const groups = new Map<string, { family: RecipeBrowserFamily; records: ComponentCardIndexRecord[] }>();
    for (const record of pageRecords) {
      const family = getRecipeBrowserFamily(record);
      const group = groups.get(family.key);
      if (group) group.records.push(record);
      else groups.set(family.key, { family, records: [record] });
    }
    return [...groups.values()];
  }, [pageRecords]);

  const selectRecord = useCallback((record: ComponentCardIndexRecord) => {
    setSelectedId(record.id);
    onPreviewRecord?.(record);
  }, [onPreviewRecord]);

  if (loading) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState title="Loading" body="Component blueprints are loading." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState title="Error" body={error} />
      </main>
    );
  }

  if (!groupedRecords.length) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState
          title="No Results"
          body="No craftable components match the current search and filters."
        />
      </main>
    );
  }

  return (
    <main className="crb2-results">
      

      {presentation === "index" ? (
        <div className="craft-v31-index-intro" aria-live="polite">
          {selectedMaterialIds.size
            ? "Recipes using " + (materialMatchMode === "all" ? "every" : "any") + " selected material"
            : "Browse recipes and investigate their quality response."}
        </div>
      ) : null}
      <div className={presentation === "index" ? "crb2-list craft-v31-recipe-list" : "crb2-list"} aria-label="Component results">
        {presentation === "index" ? pageRecords.map((record) => {
          const componentImageUrl = resolveComponentImageUrl({
            entityClass: record.entityClass,
            componentId: record.id,
            componentName: record.name,
            componentType: record.type,
            size: record.size,
            className: record.class,
          });
          const materials = record.materials?.length
            ? record.materials.map((material) => material.name)
            : record.facets.materialNames;
          const ids = record.facets?.materials ?? [];
          const names = record.facets?.materialNames ?? [];
          const selectedMaterialMatches = [...selectedMaterialIds].filter((value) => ids.includes(value) || names.includes(value)).length;
          const isPreviewOnly = isBlueprintSourceVerified?.(record) === false;
          const isUnavailable = isPreviewOnly || Boolean(isBlueprintUnavailable?.(record));
          return (
            <button
              key={record.id}
              type="button"
              className={"craft-v31-recipe-row" + (selectedRecord?.id === record.id ? " is-active" : "") + (isUnavailable ? " is-unavailable" : "")}
              aria-pressed={selectedRecord?.id === record.id}
              title={isPreviewOnly
                ? "Recipe preview only: no verified obtainable in-game blueprint source"
                : isUnavailable ? "Unavailable: every blueprint source is disabled in the current release" : undefined}
              data-crafting-record-id={record.id}
              onClick={() => selectRecord(record)}
            >
              <RecipeComponentThumbnail key={record.id} imageUrl={componentImageUrl} />
              <span className="craft-v31-recipe-copy">
                <strong title={record.name}>{record.name}</strong>
                <small>
                  {isUnavailable ? <span className="craft-v31-recipe-unavailable">{isPreviewOnly ? "Preview only" : "Unavailable"} · </span> : null}
                  {record.typeLabel}{record.size !== null ? " · S" + record.size : ""}{record.grade ? " · Grade " + record.grade : ""} · {materials.length} materials
                </small>
                <span className="craft-v31-material-chips">
                  {materials.slice(0,4).map((name, index) => (
                    <span
                      key={record.id + ":" + name + ":" + index}
                      className={selectedMaterialIds.has(ids[index] ?? "") || selectedMaterialIds.has(name) ? "is-matching" : undefined}
                    >{name}</span>
                  ))}
                  {materials.length > 4 ? <span>{"+" + (materials.length - 4)}</span> : null}
                  {!materials.length ? <span>No material records</span> : null}
                </span>
              </span>
              <span className="craft-v31-recipe-end" aria-hidden="true">
                {selectedMaterialIds.size
                  ? String(selectedMaterialMatches) + "/" + String(selectedMaterialIds.size)
                  : isRecipeQueued(record) ? "QUEUED" : isPreviewOnly ? "PREVIEW" : "›"}
              </span>
            </button>
          );
        }) : tableGroups.map(({ family, records: familyRecords }) => (
          <RecipeResultsTable
            key={family.key}
            family={family}
            records={familyRecords}
            selectedId={selectedRecord?.id ?? ""}
            onSelect={selectRecord}
            layoutMode={layoutMode}
          />
        ))}
      </div>

      {presentation === "index" ? (
        <div className="craft-v31-index-note">
          Recipe requirements and availability come from the extracted crafting catalog. Unverified blueprints remain preview-only.
        </div>
      ) : null}
    </main>
  );
}
