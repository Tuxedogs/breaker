import json
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


SCINTEL_ROOT = Path(r"D:\scintel")
RECORDS_ROOT = SCINTEL_ROOT / "libs" / "foundry" / "records"
REF_INDEX_PATH = SCINTEL_ROOT / "api" / "ref_index.json"
BLUEPRINTS_PATH = SCINTEL_ROOT / "api" / "crafting" / "blueprints.json"
LOCALIZATION_PATH = SCINTEL_ROOT / "p4k_localization_live_20260604-233441" / "Data" / "Localization" / "english" / "global.ini"
OUT_DIR = SCINTEL_ROOT / "api" / "fitting"

SOURCE_DIRS = {
    "shield": RECORDS_ROOT / "entities" / "scitem" / "ships" / "shieldgenerator",
    "power_plant": RECORDS_ROOT / "entities" / "scitem" / "ships" / "powerplant",
    "cooler": RECORDS_ROOT / "entities" / "scitem" / "ships" / "cooler",
    "quantum_drive": RECORDS_ROOT / "entities" / "scitem" / "ships" / "quantumdrive",
    "ship_weapon": RECORDS_ROOT / "entities" / "scitem" / "ships" / "weapons",
    "missile_rack": RECORDS_ROOT / "entities" / "scitem" / "ships" / "missile_racks",
    "weapon_mount": RECORDS_ROOT / "entities" / "scitem" / "ships" / "weapon_mounts",
    "turret": RECORDS_ROOT / "entities" / "scitem" / "ships" / "turret",
    "utility": RECORDS_ROOT / "entities" / "scitem" / "ships" / "utility",
}

CATEGORY_FILE = {
    "shield": "shields.json",
    "power_plant": "power_plants.json",
    "cooler": "coolers.json",
    "quantum_drive": "quantum_drives.json",
    "ship_weapon": "ship_weapons.json",
}


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def rel_path(path):
    try:
        return path.relative_to(RECORDS_ROOT).as_posix()
    except ValueError:
        return str(path)


def load_json(path, fallback):
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_localization():
    data = {}
    if not LOCALIZATION_PATH.exists():
        return data
    with LOCALIZATION_PATH.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for line in handle:
            line = line.rstrip("\r\n")
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key.strip()] = value.strip()
    return data


def loc_key(value):
    if not value:
        return None
    value = str(value).strip()
    return value[1:] if value.startswith("@") else None


def localize(value, localization):
    key = loc_key(value)
    if key:
        return localization.get(key)
    return value or None


def to_number(value):
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
        return int(parsed) if parsed.is_integer() else parsed
    except (TypeError, ValueError):
        return None


def parse_xml(path):
    return ET.parse(path).getroot()


def first(root, tag):
    for node in root.iter():
        if node.tag == tag:
            return node
    return None


def first_of(root, tags):
    for tag in tags:
        node = first(root, tag)
        if node is not None:
            return node
    return None


def attrs_numbered(node):
    if node is None:
        return {}
    result = {}
    for key, value in node.attrib.items():
        result[key] = to_number(value) if to_number(value) is not None else value
    return result


def load_ref_index():
    rows = load_json(REF_INDEX_PATH, [])
    by_guid = {}
    by_path = {}
    for row in rows:
        if row.get("guid"):
            by_guid[row["guid"].lower()] = row
        if row.get("path"):
            by_path[row["path"].lower()] = row
    return rows, by_guid, by_path


def resolve_record_path(ref_row):
    if not ref_row or not ref_row.get("path"):
        return None
    path = SCINTEL_ROOT / str(ref_row["path"]).replace("/", "\\")
    return path if path.exists() else None


def manufacturer_name(guid, ref_by_guid, localization, cache):
    if not guid:
        return None
    guid_key = guid.lower()
    if guid_key in cache:
        return cache[guid_key]
    row = ref_by_guid.get(guid_key)
    fallback = row.get("recordName", "").split(".")[-1] if row else None
    path = resolve_record_path(row)
    if not path:
        cache[guid_key] = fallback
        return cache[guid_key]
    try:
        root = parse_xml(path)
        loc = first(root, "Localization")
        cache[guid_key] = localize(loc.attrib.get("Name"), localization) if loc is not None else fallback
    except Exception:
        cache[guid_key] = fallback
    return cache[guid_key]


def blueprint_by_entity_path():
    rows = load_json(BLUEPRINTS_PATH, [])
    by_path = {}
    for row in rows:
        path = str(row.get("entityClassPath") or "").lower()
        if path:
            by_path[path] = row
    return by_path


def resource_states(root):
    states = []
    component = first(root, "ItemResourceComponentParams")
    if component is None:
        return states
    for state in component.iter("ItemResourceState"):
        item = {"name": state.attrib.get("name"), "consumption": {}, "generation": {}, "signatures": {}}
        for container_name, bucket in [("consumption", "consumption"), ("generation", "generation")]:
            for node in state.iter(container_name):
                resource = node.attrib.get("resource")
                amount = None
                amount_node = first_of(node, ["SStandardResourceUnit", "SPowerSegmentResourceUnit", "SMicroResourceUnit"])
                if amount_node is not None:
                    amount = to_number(amount_node.attrib.get("standardResourceUnits") or amount_node.attrib.get("units") or amount_node.attrib.get("microResourceUnits"))
                if resource:
                    item[bucket][resource] = amount
        sig = first(state, "signatureParams")
        if sig is not None:
            em = first(sig, "EMSignature")
            ir = first(sig, "IRSignature")
            item["signatures"]["em"] = attrs_numbered(em)
            item["signatures"]["ir"] = attrs_numbered(ir)
        states.append(item)
    return states


def resource_totals(states):
    totals = {"consumption": Counter(), "generation": Counter()}
    for state in states:
        for bucket in ("consumption", "generation"):
            for resource, amount in state.get(bucket, {}).items():
                if amount is not None:
                    totals[bucket][resource] += amount
    return {
        "consumption": dict(sorted(totals["consumption"].items())),
        "generation": dict(sorted(totals["generation"].items())),
    }


def heat_fields(root):
    rigid = first(root, "SEntityRigidPhysicsControllerParams")
    if rigid is None:
        return {}
    temp = first(rigid, "temperature")
    result = attrs_numbered(temp)
    item = first(rigid, "itemResourceParams")
    if item is not None:
        result["itemResourceParams"] = attrs_numbered(item)
    return result


def damage_resistances(root):
    health = first(root, "SHealthComponentParams")
    resist = first(health, "DamageResistance") if health is not None else None
    if resist is None:
        return {}
    result = {}
    for child in list(resist):
        result[child.tag] = attrs_numbered(child)
    return result


def shield_stats(root):
    node = first(root, "SCItemShieldGeneratorParams")
    data = attrs_numbered(node)
    if node is not None:
        data["resistance"] = [attrs_numbered(child) for child in node.iter("SShieldResistance")]
        data["absorption"] = [attrs_numbered(child) for child in node.iter("SShieldAbsorption")]
    return data


def quantum_stats(root):
    node = first(root, "SCItemQuantumDriveParams")
    data = attrs_numbered(node)
    params = first(node, "params") if node is not None else None
    spline = first(node, "splineJumpParams") if node is not None else None
    heat = first(node, "heatParams") if node is not None else None
    data["params"] = attrs_numbered(params)
    data["splineJumpParams"] = attrs_numbered(spline)
    data["heatParams"] = attrs_numbered(heat)
    return data


def weapon_stats(root, ref_by_guid, unresolved, source_path):
    weapon = first(root, "SCItemWeaponComponentParams")
    ammo = first(root, "SAmmoContainerComponentParams")
    fire_modes = []
    for node in root.iter():
        if node.tag.startswith("SWeaponActionFire"):
            fire_modes.append({"tag": node.tag, **attrs_numbered(node)})
    ammo_ref = ammo.attrib.get("ammoParamsRecord") if ammo is not None else None
    ammo_payload = None
    projectile = {}
    damage = {}
    if ammo_ref:
        row = ref_by_guid.get(ammo_ref.lower())
        path = resolve_record_path(row)
        if path:
            try:
                ammo_root = parse_xml(path)
                ammo_payload = {"guid": ammo_ref, "recordName": row.get("recordName"), "path": row.get("path"), "attrs": attrs_numbered(ammo_root)}
                projectile_node = first(ammo_root, "BulletProjectileParams")
                damage_node = first(ammo_root, "DamageInfo")
                projectile = attrs_numbered(projectile_node)
                damage = attrs_numbered(damage_node)
            except Exception as exc:
                unresolved.append({"kind": "ammo_ref_parse_failed", "ref": ammo_ref, "sourcePath": source_path, "error": str(exc)})
        else:
            unresolved.append({"kind": "ammo_ref_unresolved", "ref": ammo_ref, "sourcePath": source_path})
    speed = ammo_payload.get("attrs", {}).get("speed") if ammo_payload else None
    lifetime = ammo_payload.get("attrs", {}).get("lifetime") if ammo_payload else None
    return {
        "component": attrs_numbered(weapon),
        "ammoContainer": attrs_numbered(ammo),
        "ammo": ammo_payload,
        "fireModes": fire_modes,
        "damage": damage,
        "projectile": projectile,
        "derivedRangeMeters": speed * lifetime if isinstance(speed, (int, float)) and isinstance(lifetime, (int, float)) else None,
    }


def missing_fields(component):
    missing = []
    for field in ["displayName", "type", "subtype", "size", "grade", "manufacturer"]:
        if component.get(field) in (None, "", {}):
            missing.append(field)
    if component["baseStats"].get("health") is None:
        missing.append("health")
    return missing


def category_missing_stat_fields(category, record):
    stats = record.get("categoryStats") or {}
    checks = {
        "shield": ["MaxShieldHealth", "MaxShieldRegen", "DamagedRegenDelay", "DownedRegenDelay"],
        "power_plant": ["powerGeneration"],
        "cooler": ["coolingGeneration"],
        "quantum_drive": ["driveSpeed", "spoolUpTime", "cooldownTime", "quantumFuelRequirement"],
        "ship_weapon": ["damage", "fireRate", "projectileSpeed", "projectileLifetime"],
    }
    missing = []
    if category == "power_plant":
        if not record["resources"]["generation"].get("Power"):
            missing.append("powerGeneration")
    elif category == "cooler":
        if not record["resources"]["generation"].get("Coolant"):
            missing.append("coolingGeneration")
    elif category == "quantum_drive":
        params = stats.get("params") or {}
        for field in checks[category]:
            if field == "quantumFuelRequirement":
                if stats.get(field) is None:
                    missing.append(field)
            elif params.get(field) is None:
                missing.append(field)
    elif category == "ship_weapon":
        if not stats.get("damage"):
            missing.append("damage")
        if not stats.get("fireModes"):
            missing.append("fireRate")
        ammo_attrs = (stats.get("ammo") or {}).get("attrs") or {}
        if ammo_attrs.get("speed") is None:
            missing.append("projectileSpeed")
        if ammo_attrs.get("lifetime") is None:
            missing.append("projectileLifetime")
    else:
        for field in checks.get(category, []):
            if stats.get(field) is None:
                missing.append(field)
    return missing


def parse_component(path, category, localization, ref_by_guid, blueprints, manufacturer_cache, unresolved):
    root = parse_xml(path)
    source_path = root.attrib.get("__path") or rel_path(path)
    attach = first(root, "AttachDef")
    loc = first(attach, "Localization") if attach is not None else None
    purch = first(root, "SCItemPurchasableParams")
    health = first(root, "SHealthComponentParams")
    rigid = first(root, "SEntityRigidPhysicsControllerParams")
    distortion = first(root, "SDistortionParams")
    states = resource_states(root)
    resources = resource_totals(states)
    bp = blueprints.get(source_path.lower()) or {}
    manufacturer_guid = attach.attrib.get("Manufacturer") if attach is not None else bp.get("manufacturerGuid")
    display_name = (
        localize(loc.attrib.get("Name"), localization) if loc is not None else None
    ) or localize(purch.attrib.get("displayName"), localization) if purch is not None else None
    display_name = display_name or bp.get("displayName") or root.tag.split(".")[-1]
    category_stats = {}
    if category == "shield":
        category_stats = shield_stats(root)
    elif category == "quantum_drive":
        category_stats = quantum_stats(root)
    elif category == "ship_weapon":
        category_stats = weapon_stats(root, ref_by_guid, unresolved, source_path)
    base_stats = {
        "health": to_number(health.attrib.get("Health")) if health is not None else (bp.get("baseStats") or {}).get("health"),
        "hitpoints": to_number(health.attrib.get("Health")) if health is not None else (bp.get("baseStats") or {}).get("health"),
        "mass": to_number(rigid.attrib.get("Mass")) if rigid is not None else (bp.get("baseStats") or {}).get("mass"),
        "distortion": attrs_numbered(distortion) or (bp.get("baseStats") or {}).get("distortion"),
        "damageResistances": damage_resistances(root) or (bp.get("baseStats") or {}).get("damageResistances"),
    }
    record = {
        "componentKey": root.attrib.get("__ref") or root.tag.split(".")[-1],
        "entityClass": root.attrib.get("__ref"),
        "recordName": root.tag,
        "className": root.tag.split(".")[-1],
        "displayName": display_name,
        "type": attach.attrib.get("Type") if attach is not None else bp.get("componentType"),
        "subtype": attach.attrib.get("SubType") if attach is not None else None,
        "category": category,
        "size": to_number(attach.attrib.get("Size")) if attach is not None else to_number(bp.get("size")),
        "grade": to_number(attach.attrib.get("Grade")) if attach is not None else bp.get("gradeRaw"),
        "class": bp.get("class"),
        "manufacturerGuid": manufacturer_guid,
        "manufacturer": manufacturer_name(manufacturer_guid, ref_by_guid, localization, manufacturer_cache),
        "baseStats": base_stats,
        "resources": resources,
        "resourceStates": states,
        "signatures": {
            "em": next((state.get("signatures", {}).get("em") for state in states if state.get("signatures", {}).get("em")), None),
            "ir": next((state.get("signatures", {}).get("ir") for state in states if state.get("signatures", {}).get("ir")), None),
        },
        "heat": heat_fields(root),
        "tags": attach.attrib.get("Tags") if attach is not None else None,
        "compatibilityHints": {
            "attachType": attach.attrib.get("Type") if attach is not None else None,
            "attachSubType": attach.attrib.get("SubType") if attach is not None else None,
            "attachSize": to_number(attach.attrib.get("Size")) if attach is not None else None,
            "attachTags": attach.attrib.get("Tags") if attach is not None else None,
        },
        "categoryStats": category_stats,
        "source": {
            "foundryPath": source_path,
            "blueprintPath": bp.get("recordPath") or bp.get("blueprintPath"),
            "statSources": bp.get("statSources"),
        },
        "confidence": {
            "identity": "high" if display_name and display_name != root.tag.split(".")[-1] else "medium",
            "stats": "medium" if category_stats or resources["consumption"] or resources["generation"] else "low",
            "manufacturer": "medium" if manufacturer_guid else "low",
        },
    }
    missing = missing_fields(record)
    category_missing = category_missing_stat_fields(category, record)
    record["missingFields"] = missing
    record["missingCategoryStatFields"] = category_missing
    if not record["manufacturer"]:
        unresolved.append({"kind": "manufacturer_unresolved", "componentKey": record["componentKey"], "sourcePath": source_path, "manufacturerGuid": manufacturer_guid})
    if not record["displayName"]:
        unresolved.append({"kind": "display_name_unresolved", "componentKey": record["componentKey"], "sourcePath": source_path})
    return record


def wrap(registry, generated_at, records):
    return {
        "schemaVersion": 1,
        "registry": registry,
        "generatedAt": generated_at,
        "source": {
            "foundryRecords": str(RECORDS_ROOT),
            "refIndex": str(REF_INDEX_PATH),
            "blueprints": str(BLUEPRINTS_PATH),
            "localization": str(LOCALIZATION_PATH),
            "erkul": False,
            "spviewer": False,
        },
        "records": records,
    }


def write_json(path, payload):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def examples(records, category):
    return [
        {
            "displayName": row["displayName"],
            "type": row["type"],
            "subtype": row["subtype"],
            "size": row["size"],
            "manufacturer": row["manufacturer"],
            "categoryStats": row["categoryStats"],
            "resources": row["resources"],
            "sourcePath": row["source"]["foundryPath"],
        }
        for row in records
        if row["category"] == category
    ][:3]


def main():
    required = [RECORDS_ROOT, REF_INDEX_PATH, LOCALIZATION_PATH]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit(f"Missing required sources: {missing}")

    generated_at = now_iso()
    localization = load_localization()
    ref_rows, ref_by_guid, _ = load_ref_index()
    blueprints = blueprint_by_entity_path()
    manufacturer_cache = {}
    unresolved = []
    records = []
    source_counts = {}

    for category, source_dir in SOURCE_DIRS.items():
        paths = sorted(source_dir.rglob("*.xml")) if source_dir.exists() else []
        source_counts[category] = len(paths)
        for path in paths:
            try:
                records.append(parse_component(path, category, localization, ref_by_guid, blueprints, manufacturer_cache, unresolved))
            except Exception as exc:
                unresolved.append({"kind": "component_parse_failed", "category": category, "sourcePath": rel_path(path), "error": str(exc)})

    by_category = Counter(row["category"] for row in records)
    unresolved_name_or_manufacturer = sum(1 for row in records if not row.get("displayName") or not row.get("manufacturer"))
    missing_size_type_subtype = sum(1 for row in records if row.get("size") is None or not row.get("type") or not row.get("subtype"))
    missing_category_stats = {category: sum(1 for row in records if row["category"] == category and row["missingCategoryStatFields"]) for category in SOURCE_DIRS}
    identity = [
        {
            "componentKey": row["componentKey"],
            "entityClass": row["entityClass"],
            "recordName": row["recordName"],
            "className": row["className"],
            "displayName": row["displayName"],
            "category": row["category"],
            "type": row["type"],
            "subtype": row["subtype"],
            "size": row["size"],
            "manufacturer": row["manufacturer"],
            "sourcePath": row["source"]["foundryPath"],
        }
        for row in records
    ]

    report = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "phase": "fitting-phase-2-component-registry-consolidation",
        "sourceRoots": {
            "foundryRecords": str(RECORDS_ROOT),
            "refIndex": str(REF_INDEX_PATH),
            "blueprints": str(BLUEPRINTS_PATH),
            "localization": str(LOCALIZATION_PATH),
        },
        "sourceRecordsRead": {
            "foundryXmlByCategory": source_counts,
            "blueprintRecordsLoaded": len(blueprints),
            "refIndexRecordsLoaded": len(ref_rows),
            "localizedStringsLoaded": len(localization),
        },
        "counts": {
            "componentsConsolidated": len(records),
            "byCategory": dict(sorted(by_category.items())),
            "unresolvedNameOrManufacturer": unresolved_name_or_manufacturer,
            "missingSizeTypeSubtype": missing_size_type_subtype,
            "unresolvedEntries": len(unresolved),
        },
        "missingKeyStatFieldsByCategory": missing_category_stats,
        "examples": {
            "shields": examples(records, "shield"),
            "powerPlants": examples(records, "power_plant"),
            "coolers": examples(records, "cooler"),
            "quantumDrives": examples(records, "quantum_drive"),
            "shipWeapons": examples(records, "ship_weapon"),
        },
        "knownGaps": [
            "Ship weapon projectile and damage fields are populated only when ammoParamsRecord resolves through ref_index.",
            "Power plant and cooler category stats currently come from resource generation/consumption totals rather than a bespoke component-specific params node.",
            "Class is sourced from existing Scintel blueprints when a blueprint entity path match exists; non-blueprint components can have null class.",
            "Turrets, missile racks, weapon mounts, and utility components are included in the combined component registry and identity index but do not yet have specialized category files.",
            "Compatibility is limited to AttachDef type/subtype/size/tags hints; Phase 3 should join these against hardpoint allowed types and defaults.",
        ],
        "externalSourceUse": {"erkul": False, "spviewer": False, "manualSeeds": False},
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(OUT_DIR / "components.json", wrap("FittingComponentRegistry", generated_at, records))
    for category, filename in CATEGORY_FILE.items():
        write_json(OUT_DIR / filename, wrap(f"Fitting{category.title().replace('_', '')}Registry", generated_at, [row for row in records if row["category"] == category]))
    write_json(OUT_DIR / "component_identity_index.json", wrap("FittingComponentIdentityIndex", generated_at, identity))
    write_json(OUT_DIR / "component_unresolved_refs.json", wrap("FittingComponentUnresolvedRefs", generated_at, unresolved))
    write_json(OUT_DIR / "component_extraction_report.json", report)
    print(json.dumps(report["counts"], indent=2))
    print(f"wrote {OUT_DIR}")


if __name__ == "__main__":
    main()
