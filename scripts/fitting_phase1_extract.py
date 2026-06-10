import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


SCINTEL_ROOT = Path(r"D:\scintel")
RECORDS_ROOT = SCINTEL_ROOT / "libs" / "foundry" / "records"
REF_INDEX_PATH = Path(r"D:\scintel\api\ref_index.json")
LOCALIZATION_PATH = Path(
    r"D:\scintel\p4k_localization_live_20260604-233441\Data\Localization\english\global.ini"
)
OUT_DIR = Path(r"D:\scintel\api\fitting")

SHIP_DIRS = [
    RECORDS_ROOT / "entities" / "spaceships",
    RECORDS_ROOT / "entities" / "groundvehicles",
]

SKIP_NAME_RE = re.compile(
    r"(_pu_ai_|_pu_ai$|_ea_ai_|_ai_|_ai$|_template$|_override$|_unmanned_|_unmanned$|_lowfuel$|_indestructible$|gamemaster)",
    re.IGNORECASE,
)

NON_FITTING_RECORD_RE = re.compile(
    r"^(eaobjectivedestructable_|probe_comms_)|satellite",
    re.IGNORECASE,
)

FITTING_PORT_HINT_RE = re.compile(
    r"(hardpoint|weapon|gun|turret|missile|shield|cooler|power|quantum|radar|scanner|fuel|thruster|armor|"
    r"battery|jump|controller|utility|tractor|salvage|mining|bomb|seat)",
    re.IGNORECASE,
)


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def rel_path(path: Path) -> str:
    try:
        return path.relative_to(RECORDS_ROOT).as_posix()
    except ValueError:
        return str(path)


def resolve_record_path(ref_path):
    if not ref_path:
        return None
    normalized = str(ref_path).replace("/", "\\")
    candidate = SCINTEL_ROOT / normalized
    if candidate.exists():
        return candidate
    candidate = RECORDS_ROOT / normalized
    if candidate.exists():
        return candidate
    return SCINTEL_ROOT / normalized


def load_localization():
    data = {}
    if not LOCALIZATION_PATH.exists():
        return data

    with LOCALIZATION_PATH.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for line in handle:
            line = line.rstrip("\n\r")
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key.strip()] = value.strip()
    return data


def loc_key(value):
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    if value.startswith("@"):
        return value[1:]
    return None


def localize(value, localization):
    key = loc_key(value)
    if not key:
        return value if value else None
    resolved = localization.get(key)
    return resolved if resolved else None


def load_ref_index():
    with REF_INDEX_PATH.open("r", encoding="utf-8") as handle:
        rows = json.load(handle)

    by_guid = {}
    by_record_name = {}
    by_class_name = {}

    for row in rows:
        guid = str(row.get("guid") or "").lower()
        record_name = str(row.get("recordName") or "")
        if guid:
            by_guid[guid] = row
        if record_name:
            by_record_name[record_name.lower()] = row
            class_name = record_name.split(".")[-1].lower()
            by_class_name.setdefault(class_name, row)

    return rows, by_guid, by_record_name, by_class_name


def parse_xml(path):
    parser = ET.XMLParser()
    return ET.parse(path, parser=parser).getroot()


def first_descendant(root, tag):
    for node in root.iter():
        if node.tag == tag:
            return node
    return None


def children_named(node, tag):
    return [child for child in list(node) if child.tag == tag]


def node_attr(node, name):
    if node is None:
        return None
    value = node.attrib.get(name)
    return value if value not in ("", "@LOC_EMPTY", "@LOC_UNINITIALIZED", "@LOC_PLACEHOLDER") else None


def to_int(value):
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def resolve_ref(value, ref_by_guid, ref_by_class):
    if not value:
        return None

    raw = str(value).strip()
    row = ref_by_guid.get(raw.lower())
    if not row:
        row = ref_by_class.get(raw.lower())

    if not row:
        return {
            "input": raw,
            "resolved": False,
            "guid": None,
            "recordName": None,
            "type": None,
            "path": None,
            "className": raw,
        }

    return {
        "input": raw,
        "resolved": True,
        "guid": row.get("guid"),
        "recordName": row.get("recordName"),
        "type": row.get("type"),
        "path": row.get("path"),
        "className": str(row.get("recordName") or "").split(".")[-1] or None,
    }


def classify_unresolved_ref(entry):
    ref = str(entry.get("ref") or "").lower()
    port_path = " ".join(str(part or "") for part in entry.get("portPath") or []).lower()
    source_path = str(entry.get("sourcePath") or "").lower()
    text = " ".join([ref, port_path, source_path])

    if "personal_storage" in text or "personalstorage" in text:
        classification = "personal-storage"
        severity = "low"
    elif "dummy" in text or "checker" in text:
        classification = "dummy/checker"
        severity = "low"
    elif "placeholder" in text or "temp" in text:
        classification = "placeholder/temp"
        severity = "low"
    elif any(token in text for token in ["seataccess", "seat_access", "interior", "dashboard"]):
        classification = "seat/interior/access"
        severity = "low"
    elif "aegs_javelin" in text and any(
        token in text for token in ["turret", "gimbal", "apar_", "mrck_", "missile", "lfsp_"]
    ):
        classification = "capital-ship-critical"
        severity = "medium"
    elif any(token in text for token in ["missile", "bomb", "weapon", "turret", "gimbal", "controller_missile"]):
        classification = "fitting-critical"
        severity = "medium"
    else:
        classification = "unknown"
        severity = "medium"

    follow_up = "capital-ship" if "aegs_javelin" in source_path or "aegs_javelin" in ref else None
    return {"classification": classification, "severity": severity, "followUp": follow_up}


def infer_port_category(name, attach_type=None, attach_subtype=None):
    text = " ".join([str(name or ""), str(attach_type or ""), str(attach_subtype or "")]).lower()
    checks = [
        ("weapon", ["weapon", "gun", "hardpoint_class"]),
        ("turret", ["turret"]),
        ("missile", ["missile", "missilerack", "missilelauncher"]),
        ("shield", ["shield"]),
        ("power", ["power_plant", "powerplant", "power"]),
        ("cooler", ["cooler"]),
        ("quantum", ["quantum", "jump_drive"]),
        ("radar", ["radar"]),
        ("thruster", ["thruster"]),
        ("fuel", ["fuel"]),
        ("armor", ["armor"]),
        ("controller", ["controller"]),
        ("seat", ["seat"]),
        ("utility", ["utility", "tractor", "salvage", "mining"]),
        ("bomb", ["bomb"]),
    ]
    for category, needles in checks:
        if any(needle in text for needle in needles):
            return category
    return "other"


def infer_port_size(name, min_size=None, max_size=None, attach_size=None):
    if min_size is not None or max_size is not None:
        return {"min": min_size, "max": max_size, "source": "SItemPortDef"}
    if attach_size is not None:
        return {"min": attach_size, "max": attach_size, "source": "AttachDef"}
    match = re.search(r"(?:class_|_s|size_?)(\d+)", str(name or ""), flags=re.IGNORECASE)
    if match:
        size = int(match.group(1))
        return {"min": size, "max": size, "source": "portName"}
    return {"min": None, "max": None, "source": None}


def parse_port_def(port_node, localization):
    types = []
    types_node = port_node.find("Types")
    if types_node is not None:
        for type_node in types_node.findall("SItemPortDefTypes"):
            subtypes = []
            subtypes_node = type_node.find("SubTypes")
            if subtypes_node is not None:
                for enum_node in subtypes_node.findall("Enum"):
                    if enum_node.attrib.get("value"):
                        subtypes.append(enum_node.attrib["value"])
            types.append({"type": type_node.attrib.get("Type"), "subtypes": subtypes})

    return {
        "name": port_node.attrib.get("Name"),
        "displayNameKey": loc_key(port_node.attrib.get("DisplayName")),
        "displayName": localize(port_node.attrib.get("DisplayName"), localization),
        "flags": port_node.attrib.get("Flags"),
        "portTags": port_node.attrib.get("PortTags"),
        "minSize": to_int(port_node.attrib.get("MinSize")),
        "maxSize": to_int(port_node.attrib.get("MaxSize")),
        "types": types,
        "defaultWeaponGroup": port_node.attrib.get("DefaultWeaponGroup"),
    }


def parse_entity_metadata(path, localization):
    root = parse_xml(path)
    attach = first_descendant(root, "AttachDef")
    loc = attach.find("Localization") if attach is not None else None
    purch = first_descendant(root, "SCItemPurchasableParams")

    port_defs = {}
    for port_node in root.iter("SItemPortDef"):
        parsed = parse_port_def(port_node, localization)
        if parsed.get("name"):
            port_defs[parsed["name"].lower()] = parsed

    attach_type = node_attr(attach, "Type")
    attach_subtype = node_attr(attach, "SubType")
    attach_size = to_int(node_attr(attach, "Size"))

    return {
        "entityClass": root.attrib.get("__ref"),
        "className": root.tag.split(".")[-1],
        "path": root.attrib.get("__path") or rel_path(path),
        "attach": {
            "type": attach_type,
            "subtype": attach_subtype,
            "size": attach_size,
            "grade": to_int(node_attr(attach, "Grade")),
            "manufacturerGuid": node_attr(attach, "Manufacturer"),
            "tags": node_attr(attach, "Tags"),
            "nameKey": loc_key(node_attr(loc, "Name")) if loc is not None else None,
            "name": localize(node_attr(loc, "Name"), localization) if loc is not None else None,
        }
        if attach is not None
        else None,
        "purchasable": {
            "displayNameKey": loc_key(node_attr(purch, "displayName")),
            "displayTypeKey": loc_key(node_attr(purch, "displayType")),
            "displayName": localize(node_attr(purch, "displayName"), localization),
            "displayType": localize(node_attr(purch, "displayType"), localization),
        }
        if purch is not None
        else None,
        "portDefs": port_defs,
    }


def load_entity_metadata(resolved, records_root, localization, cache, unresolved):
    if not resolved or not resolved.get("resolved") or not resolved.get("path"):
        return None
    path = resolve_record_path(resolved.get("path"))
    key = str(path).lower()
    if key in cache:
        return cache[key]
    if not path.exists():
        unresolved.append({"kind": "entity_xml_missing", "ref": resolved, "expectedPath": str(path)})
        cache[key] = None
        return None
    try:
        cache[key] = parse_entity_metadata(path, localization)
    except Exception as exc:
        unresolved.append({"kind": "entity_xml_parse_failed", "ref": resolved, "path": str(path), "error": str(exc)})
        cache[key] = None
    return cache[key]


def entry_children(entry):
    result = []
    loadout = entry.find("loadout")
    if loadout is None:
        return result
    for params in loadout.iter("SItemPortLoadoutManualParams"):
        entries = params.find("entries")
        if entries is None:
            continue
        result.extend([child for child in list(entries) if child.tag == "SItemPortLoadoutEntryParams"])
        break
    return result


def loadout_entry_segments(entries):
    totals = Counter((entry.attrib.get("itemPortName") or "unknown") for entry in entries)
    seen = Counter()
    for entry in entries:
        port_name = entry.attrib.get("itemPortName") or "unknown"
        seen[port_name] += 1
        occurrence = seen[port_name]
        total = totals[port_name]
        segment = port_name if total == 1 else f"{port_name}__{occurrence}"
        yield entry, segment, occurrence, total


def parse_loadout_entry(
    entry,
    path_stack,
    path_segment,
    sibling_occurrence,
    sibling_count,
    ship_key,
    source_path,
    ref_by_guid,
    ref_by_class,
    records_root,
    localization,
    entity_cache,
    unresolved,
    parent_entity_meta=None,
    loadout_flat=None,
):
    port_name = entry.attrib.get("itemPortName")
    node_id = "/".join([p for p in path_stack + [path_segment or port_name or "unknown"] if p])
    ref_kind = None
    ref_value = None
    if entry.attrib.get("entityClassReference"):
        ref_kind = "entityClassReference"
        ref_value = entry.attrib.get("entityClassReference")
    elif entry.attrib.get("entityClassName"):
        ref_kind = "entityClassName"
        ref_value = entry.attrib.get("entityClassName")

    resolved = resolve_ref(ref_value, ref_by_guid, ref_by_class) if ref_value else None
    if resolved and not resolved["resolved"]:
        unresolved.append(
            {
                "kind": "default_loadout_ref_unresolved",
                "shipKey": ship_key,
                "portPath": node_id.split("/") if node_id else [port_name],
                "refKind": ref_kind,
                "ref": ref_value,
                "sourcePath": source_path,
                **classify_unresolved_ref(
                    {
                        "portPath": node_id.split("/") if node_id else [port_name],
                        "ref": ref_value,
                        "sourcePath": source_path,
                    }
                ),
            }
        )

    entity_meta = load_entity_metadata(resolved, records_root, localization, entity_cache, unresolved)
    parent_port_def = None
    if parent_entity_meta and port_name:
        parent_port_def = parent_entity_meta.get("portDefs", {}).get(port_name.lower())

    attach = entity_meta.get("attach") if entity_meta else None
    size = infer_port_size(
        port_name,
        parent_port_def.get("minSize") if parent_port_def else None,
        parent_port_def.get("maxSize") if parent_port_def else None,
        attach.get("size") if attach else None,
    )
    category = infer_port_category(
        port_name,
        attach.get("type") if attach else None,
        attach.get("subtype") if attach else None,
    )

    child_entries = entry_children(entry)
    node = {
        "id": node_id,
        "portName": port_name,
        "portNameOccurrence": sibling_occurrence if sibling_count > 1 else None,
        "portNameSiblingCount": sibling_count if sibling_count > 1 else None,
        "idCollisionAvoided": sibling_count > 1,
        "category": category,
        "portType": attach.get("type") if attach else (parent_port_def["types"][0]["type"] if parent_port_def and parent_port_def["types"] else None),
        "portSubType": attach.get("subtype") if attach else None,
        "minSize": size["min"],
        "maxSize": size["max"],
        "sizeSource": size["source"],
        "flags": parent_port_def.get("flags") if parent_port_def else None,
        "portTags": parent_port_def.get("portTags") if parent_port_def else None,
        "allowedTypes": parent_port_def.get("types") if parent_port_def else [],
        "defaultItem": {
            "refKind": ref_kind,
            "ref": ref_value,
            "resolved": bool(resolved and resolved.get("resolved")),
            "guid": resolved.get("guid") if resolved else None,
            "recordName": resolved.get("recordName") if resolved else None,
            "className": resolved.get("className") if resolved else None,
            "path": resolved.get("path") if resolved else None,
            "displayName": (attach.get("name") if attach else None)
            or ((entity_meta.get("purchasable") or {}).get("displayName") if entity_meta else None),
            "attachType": attach.get("type") if attach else None,
            "attachSubType": attach.get("subtype") if attach else None,
            "attachSize": attach.get("size") if attach else None,
        },
        "sourcePath": source_path,
        "children": [],
    }

    if loadout_flat is not None:
        loadout_flat.append(
            {
                "shipKey": ship_key,
                "portPath": node_id,
                "portName": port_name,
                "defaultItem": node["defaultItem"],
                "sourcePath": source_path,
            }
        )

    for child, child_segment, child_occurrence, child_count in loadout_entry_segments(child_entries):
        node["children"].append(
            parse_loadout_entry(
                child,
                path_stack + [path_segment or port_name or "unknown"],
                child_segment,
                child_occurrence,
                child_count,
                ship_key,
                source_path,
                ref_by_guid,
                ref_by_class,
                records_root,
                localization,
                entity_cache,
                unresolved,
                entity_meta,
                loadout_flat,
            )
        )
    return node


def root_loadout_entries(root):
    component = first_descendant(root, "SEntityComponentDefaultLoadoutParams")
    if component is None:
        return []
    loadout = component.find("loadout")
    if loadout is None:
        return []
    manual = loadout.find("SItemPortLoadoutManualParams")
    if manual is None:
        return []
    entries = manual.find("entries")
    if entries is None:
        return []
    return [child for child in list(entries) if child.tag == "SItemPortLoadoutEntryParams"]


def parse_ship(path, localization, ref_by_guid, ref_by_class, entity_cache):
    root = parse_xml(path)
    vehicle = first_descendant(root, "VehicleComponentParams")
    if vehicle is None:
        return None, [{"kind": "missing_vehicle_component", "sourcePath": rel_path(path)}]

    unresolved = []
    manufacturer_ref = resolve_ref(vehicle.attrib.get("manufacturer"), ref_by_guid, ref_by_class)
    manufacturer_meta = load_entity_metadata(manufacturer_ref, RECORDS_ROOT, localization, entity_cache, unresolved)
    manufacturer_name = None
    if manufacturer_meta:
        attach = manufacturer_meta.get("attach") or {}
        purch = manufacturer_meta.get("purchasable") or {}
        manufacturer_name = attach.get("name") or purch.get("displayName")
    if not manufacturer_name and manufacturer_ref and manufacturer_ref.get("recordName"):
        manufacturer_name = manufacturer_ref["recordName"].split(".")[-1]

    ship_key = root.attrib.get("__ref") or root.tag.split(".")[-1]
    source_path = root.attrib.get("__path") or rel_path(path)
    ship = {
        "shipKey": ship_key,
        "entityClass": root.attrib.get("__ref"),
        "className": root.tag.split(".")[-1],
        "recordName": root.tag,
        "name": localize(vehicle.attrib.get("vehicleName"), localization) or root.tag.split(".")[-1],
        "nameKey": loc_key(vehicle.attrib.get("vehicleName")),
        "description": localize(vehicle.attrib.get("vehicleDescription"), localization),
        "descriptionKey": loc_key(vehicle.attrib.get("vehicleDescription")),
        "manufacturerGuid": vehicle.attrib.get("manufacturer"),
        "manufacturer": manufacturer_name,
        "manufacturerRef": manufacturer_ref,
        "career": localize(vehicle.attrib.get("vehicleCareer"), localization),
        "careerKey": loc_key(vehicle.attrib.get("vehicleCareer")),
        "careerRef": vehicle.attrib.get("vehicleCareerRef"),
        "role": localize(vehicle.attrib.get("vehicleRole"), localization),
        "roleKey": loc_key(vehicle.attrib.get("vehicleRole")),
        "roleRef": vehicle.attrib.get("vehicleRoleRef"),
        "movementClass": vehicle.attrib.get("movementClass"),
        "crewSize": to_int(vehicle.attrib.get("crewSize")),
        "isGroundVehicle": vehicle.attrib.get("movementClass") == "GroundVehicle" or "groundvehicles" in source_path,
        "sourcePath": source_path,
        "confidence": {
            "identity": "high" if loc_key(vehicle.attrib.get("vehicleName")) else "medium",
            "manufacturer": "medium" if manufacturer_name else "low",
            "role": "medium" if loc_key(vehicle.attrib.get("vehicleRole")) else "low",
            "loadout": "high" if root_loadout_entries(root) else "low",
        },
    }

    root_port_defs = {}
    for port_node in root.iter("SItemPortDef"):
        parsed = parse_port_def(port_node, localization)
        if parsed.get("name"):
            root_port_defs[parsed["name"].lower()] = parsed
    root_meta = {"portDefs": root_port_defs}

    loadout_flat = []
    tree = []
    for entry, segment, occurrence, sibling_count in loadout_entry_segments(root_loadout_entries(root)):
        tree.append(
            parse_loadout_entry(
                entry,
                [],
                segment,
                occurrence,
                sibling_count,
                ship_key,
                source_path,
                ref_by_guid,
                ref_by_class,
                RECORDS_ROOT,
                localization,
                entity_cache,
                unresolved,
                root_meta,
                loadout_flat,
            )
        )

    return {
        "ship": ship,
        "hardpoints": {
            "shipKey": ship_key,
            "sourcePath": source_path,
            "portCount": count_tree(tree),
            "topLevelPortCount": len(tree),
            "tree": tree,
            "summary": summarize_tree(tree),
        },
        "loadout": {
            "shipKey": ship_key,
            "sourcePath": source_path,
            "entryCount": len(loadout_flat),
            "entries": loadout_flat,
        },
    }, unresolved


def count_tree(nodes):
    return sum(1 + count_tree(node.get("children", [])) for node in nodes)


def summarize_tree(nodes):
    categories = Counter()
    resolved = 0
    unresolved = 0
    for node in walk_nodes(nodes):
        categories[node.get("category") or "other"] += 1
        if node.get("defaultItem", {}).get("ref"):
            if node["defaultItem"].get("resolved"):
                resolved += 1
            else:
                unresolved += 1
    return {
        "categories": dict(sorted(categories.items())),
        "resolvedDefaultRefs": resolved,
        "unresolvedDefaultRefs": unresolved,
    }


def walk_nodes(nodes):
    for node in nodes:
        yield node
        yield from walk_nodes(node.get("children", []))


def should_skip_ship(path):
    stem = path.stem.lower()
    if SKIP_NAME_RE.search(stem):
        return "npc_ai_template_override_unmanned_or_gamemaster_filename"
    if NON_FITTING_RECORD_RE.search(stem):
        return "non_fitting_objective_probe_satellite_record"
    return None


def duplicate_port_report(ships, hardpoints):
    by_ship = {ship["shipKey"]: ship for ship in ships}
    findings = []
    for hp in hardpoints:
        avoided = [node for node in walk_nodes(hp["tree"]) if node.get("idCollisionAvoided")]
        if not avoided:
            continue
        ship = by_ship.get(hp["shipKey"], {})
        findings.append(
            {
                "shipKey": hp["shipKey"],
                "name": ship.get("name"),
                "sourcePath": hp.get("sourcePath"),
                "duplicateSiblingPortNames": len(avoided),
                "assessment": "source loadout repeats the same itemPortName under one parent; generated ids are disambiguated with occurrence suffixes while raw portName is preserved",
                "examples": [
                    {
                        "id": node.get("id"),
                        "portName": node.get("portName"),
                        "occurrence": node.get("portNameOccurrence"),
                        "siblingCount": node.get("portNameSiblingCount"),
                        "category": node.get("category"),
                        "defaultClassName": node.get("defaultItem", {}).get("className"),
                    }
                    for node in avoided[:10]
                ],
            }
        )
    return findings


def unresolved_classification_counts(unresolved):
    counts = Counter(entry.get("classification") or "unknown" for entry in unresolved)
    return dict(sorted(counts.items()))


def main():
    required = [RECORDS_ROOT, REF_INDEX_PATH, LOCALIZATION_PATH]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit(f"Missing required sources: {missing}")

    generated_at = now_iso()
    localization = load_localization()
    _, ref_by_guid, _, ref_by_class = load_ref_index()

    source_files = []
    for ship_dir in SHIP_DIRS:
        source_files.extend(sorted(ship_dir.rglob("*.xml")))

    ships = []
    hardpoints = []
    loadouts = []
    unresolved = []
    skipped = []
    parse_failures = []
    entity_cache = {}

    for path in source_files:
        skip_reason = should_skip_ship(path)
        if skip_reason:
            skipped.append({"sourcePath": rel_path(path), "reason": skip_reason})
            continue
        try:
            parsed, local_unresolved = parse_ship(path, localization, ref_by_guid, ref_by_class, entity_cache)
        except ET.ParseError as exc:
            parse_failures.append({"sourcePath": rel_path(path), "error": str(exc)})
            continue
        except Exception as exc:
            parse_failures.append({"sourcePath": rel_path(path), "error": str(exc)})
            continue
        unresolved.extend(local_unresolved)
        if not parsed:
            skipped.append({"sourcePath": rel_path(path), "reason": "no_vehicle_component"})
            continue
        if parsed["hardpoints"]["portCount"] == 0 and NON_FITTING_RECORD_RE.search(path.stem):
            skipped.append({"sourcePath": rel_path(path), "reason": "zero_port_non_fitting_fixture"})
            continue
        ships.append(parsed["ship"])
        hardpoints.append(parsed["hardpoints"])
        loadouts.append(parsed["loadout"])

    default_refs_resolved = 0
    default_refs_unresolved = 0
    ships_with_item_ports = 0
    for hp in hardpoints:
        if hp["portCount"] > 0:
            ships_with_item_ports += 1
        default_refs_resolved += hp["summary"]["resolvedDefaultRefs"]
        default_refs_unresolved += hp["summary"]["unresolvedDefaultRefs"]

    skip_reason_counts = Counter(row["reason"] for row in skipped)
    duplicate_findings = duplicate_port_report(ships, hardpoints)
    unresolved_breakdown = unresolved_classification_counts(unresolved)
    capital_unresolved = [
        entry
        for entry in unresolved
        if entry.get("followUp") == "capital-ship" or entry.get("classification") == "capital-ship-critical"
    ]

    report = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "phase": "fitting-phase-1-ship-registry-hardpoints",
        "sourceRoots": {
            "foundryRecords": str(RECORDS_ROOT),
            "shipDirs": [str(path) for path in SHIP_DIRS],
            "refIndex": str(REF_INDEX_PATH),
            "localization": str(LOCALIZATION_PATH),
        },
        "sourceRecordsRead": {
            "candidateShipXml": len(source_files),
            "shipXmlExtracted": len(ships),
            "skipped": len(skipped),
            "parseFailures": len(parse_failures),
            "localizedStringsLoaded": len(localization),
            "refIndexRecordsLoaded": len(ref_by_guid),
            "installedEntityXmlParsed": len([value for value in entity_cache.values() if value]),
        },
        "counts": {
            "shipsExtracted": len(ships),
            "shipsWithItemPorts": ships_with_item_ports,
            "hardpointTrees": len(hardpoints),
            "defaultLoadoutRefsResolved": default_refs_resolved,
            "defaultLoadoutRefsUnresolved": default_refs_unresolved,
            "unresolvedEntries": len(unresolved),
            "duplicatePortIdFindings": len(duplicate_findings),
            "capitalShipFollowUpRefs": len(capital_unresolved),
        },
        "skipReasonCounts": dict(sorted(skip_reason_counts.items())),
        "unresolvedClassificationCounts": unresolved_breakdown,
        "duplicatePortIdInvestigation": duplicate_findings,
        "capitalShipFollowUpSamples": capital_unresolved[:50],
        "confidence": {
            "shipIdentity": "high when VehicleComponentParams vehicleName localizes, medium when class-name fallback is used",
            "manufacturer": "medium when SCItemManufacturer ref resolves; display can fall back to manufacturer code",
            "hardpointTree": "high for default loadout topology, medium for inferred port category",
            "compatibility": "partial; SItemPortDef types/min/max are captured when the parent entity XML exposes them",
        },
        "knownGaps": [
            "NPC/AI/template/override/unmanned/gamemaster filenames are skipped for fitting-focused Phase 1 outputs.",
            "Ports without default items are included only when they appear in ship or installed item SItemPortDef context; empty unused child ports can remain absent from default loadout trees.",
            "Port category is inferred from port names and installed AttachDef type/subtype, not a final compatibility model.",
            "Some default entityClassName values are class-name strings that may not resolve through ref_index; they are classified in unresolved_ship_refs.json.",
            "Capital-ship unresolved refs are kept visible as follow-up work without blocking normal fitting coverage.",
            "Turret/gimbal relationships are captured when visible as nested loadout entries, but behavior/arc validation is not extracted in Phase 1.",
        ],
        "externalSourceUse": {
            "erkul": False,
            "spviewer": False,
            "manualSeeds": False,
        },
        "examples": build_examples(ships, hardpoints),
        "skippedSamples": skipped[:50],
        "parseFailureSamples": parse_failures[:50],
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(OUT_DIR / "ships.json", wrap("ShipRegistry", generated_at, ships))
    write_json(OUT_DIR / "ship_hardpoints.json", wrap("HardpointRegistry", generated_at, hardpoints))
    write_json(OUT_DIR / "default_loadouts.json", wrap("DefaultLoadoutRegistry", generated_at, loadouts))
    write_json(OUT_DIR / "unresolved_ship_refs.json", wrap("UnresolvedShipRefs", generated_at, unresolved))
    write_json(OUT_DIR / "ship_extraction_report.json", report)

    print(json.dumps(report["counts"], indent=2))
    print(f"wrote {OUT_DIR}")


def wrap(name, generated_at, records):
    return {
        "schemaVersion": 1,
        "registry": name,
        "generatedAt": generated_at,
        "source": {
            "foundryRecords": str(RECORDS_ROOT),
            "refIndex": str(REF_INDEX_PATH),
            "localization": str(LOCALIZATION_PATH),
        },
        "records": records,
    }


def write_json(path, payload):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def build_examples(ships, hardpoints):
    wanted = ["Gladius", "Cutlass", "Aurora"]
    by_ship = {ship["shipKey"]: ship for ship in ships}
    examples = []
    for wanted_name in wanted:
        ship = next((ship for ship in ships if wanted_name.lower() in (ship.get("name") or "").lower()), None)
        if not ship:
            continue
        hp = next((record for record in hardpoints if record["shipKey"] == ship["shipKey"]), None)
        if not hp:
            continue
        examples.append(
            {
                "shipKey": ship["shipKey"],
                "name": ship["name"],
                "sourcePath": ship["sourcePath"],
                "portCount": hp["portCount"],
                "summary": hp["summary"],
                "topLevelPorts": [
                    {
                        "portName": node.get("portName"),
                        "category": node.get("category"),
                        "defaultClassName": node.get("defaultItem", {}).get("className"),
                        "children": len(node.get("children", [])),
                    }
                    for node in hp["tree"][:12]
                ],
            }
        )
    if len(examples) < 3:
        for hp in hardpoints:
            ship = by_ship.get(hp["shipKey"])
            if not ship or any(example["shipKey"] == hp["shipKey"] for example in examples):
                continue
            examples.append(
                {
                    "shipKey": ship["shipKey"],
                    "name": ship["name"],
                    "sourcePath": ship["sourcePath"],
                    "portCount": hp["portCount"],
                    "summary": hp["summary"],
                    "topLevelPorts": [
                        {
                            "portName": node.get("portName"),
                            "category": node.get("category"),
                            "defaultClassName": node.get("defaultItem", {}).get("className"),
                            "children": len(node.get("children", [])),
                        }
                        for node in hp["tree"][:12]
                    ],
                }
            )
            if len(examples) >= 3:
                break
    return examples[:3]


if __name__ == "__main__":
    main()
