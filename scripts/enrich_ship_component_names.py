import csv
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_DIR = Path(r"D:\ASCExports\api")
VEHICLE_JSON = API_DIR / "vehicle_components.json"
VEHICLE_LONG = API_DIR / "vehiclegear_components_long.csv"
LOOKUP_CSV = API_DIR / "ship_component_name_lookup.csv"
NAMED_CSV = API_DIR / "ship_components_named.csv"
NAMED_JSON = API_DIR / "ship_components_named.json"
UNRESOLVED_CSV = API_DIR / "ship_component_unresolved.csv"
PUBLIC_VEHICLE_JSON = Path("public/api/vehicle_components.json")

TODO: delete this page it is not used.

WIKI_TYPES = [
    "Cooler",
    "PowerPlant",
    "QuantumDrive",
    "Radar",
    "Shield",
    "WeaponGun",
    "Turret",
    "TractorBeam",
    "MiningModifier",
    "SalvageModifier",
    "Bomb",
    "Missile",
    "EMP",
]

TYPE_TO_CATEGORY = {
    "cooler": "cooler",
    "powerplant": "powerplant",
    "quantumdrive": "quantumdrive",
    "radar": "radar",
    "shield": "shield",
    "weapongun": "weapons",
    "turret": "turret",
    "tractorbeam": "tractorbeam",
    "miningmodifier": "mininglaser",
    "salvagemodifier": "salvage",
    "bomb": "weapons",
    "missile": "weapons",
    "emp": "emp",
}

CLASS_ALIASES = {
    "mil": "Military",
    "military": "Military",
    "civ": "Civilian",
    "civilian": "Civilian",
    "ind": "Industrial",
    "industrial": "Industrial",
    "stealth": "Stealth",
    "competition": "Competition",
}

CATEGORY_ALIASES = {
    "cooler": {"cooler"},
    "powerplant": {"powerplant"},
    "quantumdrive": {"quantumdrive"},
    "radar": {"radar"},
    "shield": {"shield"},
    "mininglaser": {"mininglaser", "miningmodifier"},
    "salvage": {"salvage", "salvagemodifier"},
    "tractorbeam": {"tractorbeam"},
    "weapons": {"weapons", "weapongun", "bomb", "missile"},
    "turret": {"turret"},
}


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def norm_category(value: object) -> str:
    compact = norm(value)
    return TYPE_TO_CATEGORY.get(compact, compact)


def clean_internal_name(value: object) -> str:
    text = str(value or "").lower()
    text = re.sub(r"^bp_craft_", "", text)
    text = re.sub(r"_scitem$", "", text)
    text = re.sub(r"[^a-z0-9]+", "", text)
    return text


def file_stem(path: str) -> str:
    if not path:
        return ""
    return Path(path.replace("\\", "/")).stem


def fallback_display_name(value: object) -> str:
    text = str(value or "").strip()
    return re.sub(r"\s+Scitem$", "", text, flags=re.IGNORECASE)


def fetch_wiki_type(item_type: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        query = urlencode({"filter[type]": item_type, "page[number]": page})
        request = Request(
            f"https://api.star-citizen.wiki/api/items?{query}",
            headers={"User-Agent": "MoonbreakerDataEnricher/1.0"},
        )
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rows.extend(payload.get("data") or [])
        meta = payload.get("meta") or {}
        if page >= int(meta.get("last_page") or 1):
            break
        page += 1
    return rows


def wiki_row(item: dict) -> dict[str, str]:
    manufacturer = item.get("manufacturer") or {}
    return {
        "className": str(item.get("class_name") or ""),
        "displayName": str(item.get("name") or ""),
        "wikiUrl": str(item.get("web_url") or ""),
        "category": norm_category(item.get("type")),
        "size": "" if item.get("size") is None else str(item.get("size")),
        "grade": str(item.get("grade") or ""),
        "class": str(item.get("class") or ""),
        "manufacturer": str(manufacturer.get("name") or item.get("manufacturer_description") or ""),
    }


def write_lookup() -> list[dict[str, str]]:
    deduped: dict[str, dict[str, str]] = {}
    for item_type in WIKI_TYPES:
        for item in fetch_wiki_type(item_type):
            row = wiki_row(item)
            if row["className"] and row["displayName"]:
                deduped[row["className"].lower()] = row

    rows = sorted(deduped.values(), key=lambda row: (row["category"], row["className"].lower()))
    with LOOKUP_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["className", "displayName", "wikiUrl", "category", "size", "grade", "class", "manufacturer"],
        )
        writer.writeheader()
        writer.writerows(rows)
    return rows


def read_lookup() -> list[dict[str, str]]:
    if not LOOKUP_CSV.exists():
        return write_lookup()
    with LOOKUP_CSV.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def long_metadata() -> dict[str, dict[str, str]]:
    meta: dict[str, dict[str, str]] = {}
    if not VEHICLE_LONG.exists():
        return meta
    with VEHICLE_LONG.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            blueprint_id = row.get("blueprint_id") or ""
            if blueprint_id and blueprint_id not in meta:
                internal = file_stem(row.get("output_entity_file") or "")
                meta[blueprint_id] = {
                    "internalName": internal,
                    "sourceFile": row.get("output_entity_file") or row.get("source_file") or "",
                }
    return meta


def compatible(component: dict, lookup: dict[str, str]) -> tuple[bool, str]:
    component_category = norm_category(component.get("componentType"))
    lookup_category = norm_category(lookup.get("category"))
    allowed = CATEGORY_ALIASES.get(component_category, {component_category})
    if lookup_category and lookup_category not in allowed:
        return False, "category mismatch"

    component_size = str(component.get("size") or "").strip()
    lookup_size = str(lookup.get("size") or "").strip()
    if component_size and lookup_size and component_size != lookup_size:
        return False, "size mismatch"

    component_class = CLASS_ALIASES.get(norm(component.get("displayName")), "")
    lookup_class = CLASS_ALIASES.get(norm(lookup.get("class")), lookup.get("class") or "")
    if component_class and lookup_class and component_class.lower() != lookup_class.lower():
        return False, "class mismatch"

    return True, ""


def build_indexes(lookup_rows: list[dict[str, str]]):
    exact = {row["className"].lower(): row for row in lookup_rows if row.get("className")}
    normalized: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in lookup_rows:
        normalized[clean_internal_name(row.get("className"))].append(row)
        normalized[clean_internal_name(row.get("displayName"))].append(row)
    return exact, normalized


def find_match(component: dict, exact, normalized, lookup_rows):
    internal = component.get("internalName") or ""
    candidates: list[tuple[str, dict[str, str], str]] = []

    exact_match = exact.get(str(internal).lower())
    if exact_match:
        candidates.append(("exact", exact_match, "exact className"))

    key = clean_internal_name(internal)
    for row in normalized.get(key, []):
        candidates.append(("normalized", row, "normalized internal name"))

    if not candidates and key:
        best_score = 0.0
        best_row = None
        for row in lookup_rows:
            ok, _ = compatible(component, row)
            if not ok:
                continue
            score = SequenceMatcher(None, key, clean_internal_name(row.get("className"))).ratio()
            if score > best_score:
                best_score = score
                best_row = row
        if best_row and best_score >= 0.94:
            candidates.append(("fuzzy", best_row, f"fuzzy {best_score:.3f}"))

    for _, row, reason in candidates:
        ok, reject_reason = compatible(component, row)
        if ok:
            return row, reason
        last_reject = reject_reason
    return None, locals().get("last_reject", "no wiki match")


def enrich():
    lookup_rows = read_lookup()
    exact, normalized = build_indexes(lookup_rows)
    meta = long_metadata()
    components = json.loads(VEHICLE_JSON.read_text(encoding="utf-8-sig"))

    named = []
    unresolved = []

    for component in components:
        blueprint_id = component.get("blueprintGuid") or ""
        item_meta = meta.get(blueprint_id, {})
        internal_name = item_meta.get("internalName") or clean_internal_name(component.get("blueprintName"))
        fallback_name = fallback_display_name(component.get("displayName") or component.get("name") or internal_name)
        working = {
            **component,
            "internalName": internal_name,
            "fallbackName": fallback_name,
            "sourceFile": item_meta.get("sourceFile") or component.get("blueprintPath") or "",
        }

        match, reason = find_match(working, exact, normalized, lookup_rows)
        if match:
            display_name = match["displayName"]
            wiki_resolved = True
            wiki_url = match["wikiUrl"]
            category = match["category"] or norm_category(component.get("componentType"))
            size = match["size"] or str(component.get("size") or "")
            grade = match["grade"]
            klass = match["class"]
            manufacturer = match["manufacturer"]
        else:
            display_name = fallback_name
            wiki_resolved = False
            wiki_url = ""
            category = norm_category(component.get("componentType"))
            size = str(component.get("size") or "")
            grade = ""
            klass = ""
            manufacturer = ""
            unresolved.append({
                "internalName": internal_name,
                "fallbackName": fallback_name,
                "category": category,
                "sourceFile": working["sourceFile"],
                "reason": reason,
            })

        enriched = {
            **component,
            "id": component.get("entityClass") or blueprint_id,
            "internalName": internal_name,
            "displayName": display_name,
            "fallbackName": fallback_name,
            "wikiResolved": wiki_resolved,
            "wikiUrl": wiki_url,
            "category": category,
            "size": size,
            "grade": grade,
            "class": klass,
            "manufacturer": manufacturer,
            "sourceFile": working["sourceFile"],
            "wikiMatchReason": reason if wiki_resolved else "",
        }
        named.append(enriched)

    csv_fields = [
        "id",
        "internalName",
        "displayName",
        "fallbackName",
        "wikiResolved",
        "wikiUrl",
        "category",
        "size",
        "grade",
        "class",
        "manufacturer",
        "sourceFile",
    ]
    with NAMED_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_fields)
        writer.writeheader()
        writer.writerows([{field: row.get(field, "") for field in csv_fields} for row in named])
    NAMED_JSON.write_text(json.dumps(named, indent=2, ensure_ascii=False), encoding="utf-8")

    with UNRESOLVED_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["internalName", "fallbackName", "category", "sourceFile", "reason"])
        writer.writeheader()
        writer.writerows(unresolved)

    VEHICLE_JSON.write_text(json.dumps(named, indent=2, ensure_ascii=False), encoding="utf-8")
    PUBLIC_VEHICLE_JSON.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_VEHICLE_JSON.write_text(json.dumps(named, indent=2, ensure_ascii=False), encoding="utf-8")

    display_counts = Counter(row["displayName"] for row in named if row.get("displayName"))
    id_counts = Counter(row["id"] for row in named if row.get("id"))
    duplicate_display = sum(1 for count in display_counts.values() if count > 1)
    duplicate_ids = sum(1 for count in id_counts.values() if count > 1)

    print(f"total components: {len(named)}")
    print(f"wiki-resolved count: {sum(1 for row in named if row['wikiResolved'])}")
    print(f"fallback count: {sum(1 for row in named if not row['wikiResolved'])}")
    print(f"unresolved count: {len(unresolved)}")
    print(f"duplicate display names: {duplicate_display}")
    print(f"duplicate internal IDs: {duplicate_ids}")
    print(f"wrote lookup: {LOOKUP_CSV}")
    print(f"wrote named csv: {NAMED_CSV}")
    print(f"wrote named json: {NAMED_JSON}")
    print(f"wrote unresolved: {UNRESOLVED_CSV}")


if __name__ == "__main__":
    enrich()
