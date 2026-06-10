import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


SCINTEL_ROOT = Path(r"D:\scintel")
FITTING_DIR = SCINTEL_ROOT / "api" / "fitting"

CATEGORY_TO_COMPONENT = {
    "shield": ["shield"],
    "power": ["power_plant"],
    "cooler": ["cooler"],
    "quantum": ["quantum_drive"],
    "weapon": ["ship_weapon"],
    "missile": ["missile_rack"],
    "turret": ["turret"],
    "utility": ["utility"],
    "mount/gimbal": ["weapon_mount"],
}

COMPONENT_TO_RULE_CATEGORY = {
    "shield": "shield",
    "power_plant": "power",
    "cooler": "cooler",
    "quantum_drive": "quantum",
    "ship_weapon": "weapon",
    "missile_rack": "missile",
    "turret": "turret",
    "utility": "utility",
    "weapon_mount": "mount/gimbal",
}

SUPPORT_NAME_HINTS = [
    "paint",
    "seat",
    "door",
    "dashboard",
    "display",
    "screen",
    "hud",
    "storage",
    "access",
    "dummy",
    "checker",
    "placeholder",
    "temp",
    "interior",
    "thruster",
    "fuel",
    "radar",
    "controller",
    "self_destruct",
    "selfdestruct",
    "armor",
    "lifesupport",
    "life_support",
]

SUPPORT_CATEGORIES = {"other", "seat", "thruster", "fuel", "radar", "controller", "armor"}


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_registry(name):
    path = FITTING_DIR / name
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data["records"]


def write_json(path, payload):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def wrap(registry, generated_at, records):
    return {
        "schemaVersion": 1,
        "registry": registry,
        "generatedAt": generated_at,
        "source": {
            "ships": str(FITTING_DIR / "ships.json"),
            "shipHardpoints": str(FITTING_DIR / "ship_hardpoints.json"),
            "defaultLoadouts": str(FITTING_DIR / "default_loadouts.json"),
            "components": str(FITTING_DIR / "components.json"),
            "erkul": False,
            "spviewer": False,
        },
        "records": records,
    }


def walk(nodes, parent=None, depth=0):
    for node in nodes:
        yield node, parent, depth
        yield from walk(node.get("children") or [], node, depth + 1)


def text_blob(*values):
    return " ".join(str(value or "").lower() for value in values)


def is_support_port(port):
    name = text_blob(port.get("id"), port.get("portName"), port.get("portType"), port.get("portSubType"))
    if port.get("category") in SUPPORT_CATEGORIES:
        return True
    return any(hint in name for hint in SUPPORT_NAME_HINTS)


def infer_rule_category(port, parent=None):
    default = port.get("defaultItem") or {}
    text = text_blob(
        port.get("id"),
        port.get("portName"),
        port.get("category"),
        port.get("portType"),
        port.get("portSubType"),
        default.get("attachType"),
        default.get("attachSubType"),
        default.get("className"),
        default.get("path"),
        default.get("displayName"),
    )
    category = port.get("category")

    if "shield" in text:
        return "shield"
    if "powerplant" in text or "power_plant" in text or "power plant" in text:
        return "power"
    if "cooler" in text:
        return "cooler"
    if "quantumdrive" in text or "quantum_drive" in text or "quantum drive" in text:
        return "quantum"
    if default.get("attachType") == "WeaponGun":
        return "weapon"
    if default.get("attachType") == "Missile":
        return "missile"
    if "weapon_mounts" in text or "gimbal" in text or "varipuck" in text or "mount_gimbal" in text:
        return "mount/gimbal"
    if "missilerack" in text or "missilelauncher" in text or "missile_launcher" in text:
        return "missile"
    if "turretbase" in text or "turret" in text:
        return "turret"
    if "tractor" in text or "salvage" in text or category == "utility":
        return "utility"
    if category == "weapon" or "weapongun" in text or default.get("attachType") == "WeaponGun":
        return "weapon"
    if category in CATEGORY_TO_COMPONENT:
        return category
    return None


def component_categories_for_port(rule_category, port):
    default = port.get("defaultItem") or {}
    text = text_blob(port.get("id"), port.get("portName"), default.get("attachType"), default.get("className"), default.get("path"))
    if rule_category == "missile" and (default.get("attachType") == "Missile" or "missile_attach" in text):
        return []
    return CATEGORY_TO_COMPONENT.get(rule_category, [])


def type_subtype_allowed(port, component):
    allowed = port.get("allowedTypes") or []
    comp_type = component.get("type")
    comp_subtype = component.get("subtype")
    port_type = port.get("portType")
    port_subtype = port.get("portSubType")

    if allowed:
        for allowed_type in allowed:
            if allowed_type.get("type") != comp_type:
                continue
            subtypes = allowed_type.get("subtypes") or []
            if not subtypes or comp_subtype in subtypes or comp_subtype == "UNDEFINED":
                return True, "allowedTypes"
        return False, "allowedTypes_mismatch"

    if port_type and comp_type:
        if port_type == comp_type and (not port_subtype or port_subtype == comp_subtype or port_subtype == "UNDEFINED"):
            return True, "portType"
        return False, "portType_mismatch"

    return None, "missing_type_metadata"


def size_status(port, component):
    size = component.get("size")
    min_size = port.get("minSize")
    max_size = port.get("maxSize")
    if min_size is None and max_size is None:
        attach_size = (port.get("defaultItem") or {}).get("attachSize")
        min_size = attach_size
        max_size = attach_size
    if size is None or (min_size is None and max_size is None):
        return None, "missing_size_metadata"
    if min_size is not None and size < min_size:
        return False, "item_smaller_than_min"
    if max_size is not None and size > max_size:
        return False, "item_larger_than_max"
    if min_size == max_size == size:
        return True, "exact_size"
    return True, "within_min_max"


def compatible_components(port, rule_category, components_by_category):
    matches = []
    for component_category in component_categories_for_port(rule_category, port):
        for component in components_by_category.get(component_category, []):
            type_ok, type_reason = type_subtype_allowed(port, component)
            size_ok, size_reason = size_status(port, component)
            if type_ok is False or size_ok is False:
                continue
            if type_ok is True and size_ok is True:
                confidence = "high"
                reason = f"{type_reason}+{size_reason}"
            elif size_ok is True:
                confidence = "medium"
                reason = f"category+{size_reason};{type_reason}"
            else:
                confidence = "low"
                reason = f"category_only;{type_reason};{size_reason}"
            matches.append(
                {
                    "componentKey": component.get("componentKey"),
                    "displayName": component.get("displayName"),
                    "category": rule_category,
                    "componentCategory": component.get("category"),
                    "type": component.get("type"),
                    "subtype": component.get("subtype"),
                    "size": component.get("size"),
                    "confidence": confidence,
                    "matchReason": reason,
                    "sourcePath": (component.get("source") or {}).get("foundryPath"),
                }
            )
    return matches


def default_lookup_key(default_item):
    if not default_item:
        return None
    return (default_item.get("guid") or "").lower() or (default_item.get("path") or "").lower() or (default_item.get("className") or "").lower()


def classify_mismatch(port, default_item, rule_category, identity_by_key):
    text = text_blob(port.get("id"), port.get("portName"), default_item.get("className"), default_item.get("path"), default_item.get("attachType"))
    if is_support_port(port) or any(hint in text for hint in SUPPORT_NAME_HINTS):
        return "support/interior item"
    if "turret" in text or "gimbal" in text or "mount" in text:
        return "nested turret/gimbal/rack issue"
    if "missile" in text or "rack" in text:
        return "nested turret/gimbal/rack issue"
    key = default_lookup_key(default_item)
    comp = identity_by_key.get(key) if key else None
    if not comp:
        return "component registry missing metadata"
    comp_rule = COMPONENT_TO_RULE_CATEGORY.get(comp.get("category"))
    if comp_rule and comp_rule != rule_category:
        return "bad port category"
    if port.get("minSize") is not None or port.get("maxSize") is not None:
        return "size rule too strict"
    if not port.get("allowedTypes") and not port.get("portType"):
        return "missing allowed type/subtype"
    return "unknown"


def summarize_ship(ship, port_records, validations):
    ship_validations = [row for row in validations if row["shipKey"] == ship["shipKey"]]
    resolved = [row for row in ship_validations if row["status"] == "compatible"]
    mismatches = [row for row in ship_validations if row["status"] == "mismatch"]
    unresolved = [row for row in ship_validations if row["status"] == "unresolved"]
    return {
        "shipKey": ship["shipKey"],
        "name": ship.get("name"),
        "sourcePath": ship.get("sourcePath"),
        "fittingRelevantPortCount": len(port_records),
        "compatibleMappingCount": sum(len(port.get("compatibleItems", [])) for port in port_records),
        "defaultLoadout": {
            "compatible": len(resolved),
            "mismatch": len(mismatches),
            "unresolved": len(unresolved),
            "validationRate": round(len(resolved) / len(ship_validations), 4) if ship_validations else None,
        },
        "categories": dict(sorted(Counter(port["ruleCategory"] for port in port_records).items())),
        "topUnresolvedOrMismatches": (mismatches + unresolved)[:10],
    }


def main():
    generated_at = now_iso()
    required = [
        "ships.json",
        "ship_hardpoints.json",
        "default_loadouts.json",
        "components.json",
        "component_identity_index.json",
    ]
    missing = [name for name in required if not (FITTING_DIR / name).exists()]
    if missing:
        raise SystemExit(f"Missing required inputs: {missing}")

    ships = read_registry("ships.json")
    hardpoints = read_registry("ship_hardpoints.json")
    components = read_registry("components.json")
    identity = read_registry("component_identity_index.json")
    ship_by_key = {ship["shipKey"]: ship for ship in ships}
    components_by_category = defaultdict(list)
    for component in components:
        components_by_category[component.get("category")].append(component)

    identity_by_key = {}
    for row in identity:
        for value in [row.get("componentKey"), row.get("entityClass"), row.get("sourcePath"), row.get("className")]:
            if value:
                identity_by_key[str(value).lower()] = row

    rules = []
    by_port = []
    by_ship = []
    validations = []
    unresolved = []
    support_excluded = []
    category_counts = Counter()
    confidence_counts = Counter()
    total_mappings = 0

    for category, component_categories in CATEGORY_TO_COMPONENT.items():
        rules.append(
            {
                "category": category,
                "componentCategories": component_categories,
                "matching": {
                    "high": "type/subtype and size align",
                    "medium": "category and size align while subtype/type metadata is weak or missing",
                    "low": "category/default-loadout evidence only",
                    "unresolved": "cannot validate with current metadata",
                    "blocked": "known mismatch or unsupported support/default item",
                },
            }
        )

    for hp in hardpoints:
        ship = ship_by_key.get(hp["shipKey"], {"shipKey": hp["shipKey"]})
        ship_ports = []
        for port, parent, depth in walk(hp.get("tree") or []):
            default_item = port.get("defaultItem") or {}
            if is_support_port(port):
                support_excluded.append(
                    {
                        "shipKey": hp["shipKey"],
                        "portId": port.get("id"),
                        "portName": port.get("portName"),
                        "category": port.get("category"),
                        "reason": "support_or_non_fitting_port",
                    }
                )
                if default_item.get("ref"):
                    validations.append(
                        {
                            "shipKey": hp["shipKey"],
                            "shipName": ship.get("name"),
                            "portId": port.get("id"),
                            "portName": port.get("portName"),
                            "ruleCategory": None,
                            "defaultItem": default_item,
                            "status": "skipped_support",
                            "matchReason": "support_or_non_fitting_port",
                        }
                    )
                continue

            rule_category = infer_rule_category(port, parent)
            if not rule_category:
                support_excluded.append(
                    {
                        "shipKey": hp["shipKey"],
                        "portId": port.get("id"),
                        "portName": port.get("portName"),
                        "category": port.get("category"),
                        "reason": "no_fitting_rule_category",
                    }
                )
                continue

            compatible = compatible_components(port, rule_category, components_by_category)
            total_mappings += len(compatible)
            category_counts[rule_category] += 1
            for item in compatible:
                confidence_counts[item["confidence"]] += 1

            port_record = {
                "shipKey": hp["shipKey"],
                "shipName": ship.get("name"),
                "portId": port.get("id"),
                "portName": port.get("portName"),
                "parentPortId": parent.get("id") if parent else None,
                "depth": depth,
                "ruleCategory": rule_category,
                "portCategory": port.get("category"),
                "portType": port.get("portType"),
                "portSubType": port.get("portSubType"),
                "minSize": port.get("minSize"),
                "maxSize": port.get("maxSize"),
                "allowedTypes": port.get("allowedTypes"),
                "defaultItem": default_item,
                "compatibleItemCount": len(compatible),
                "confidenceSummary": dict(sorted(Counter(item["confidence"] for item in compatible).items())),
                "compatibleItems": compatible,
            }
            ship_ports.append(port_record)
            by_port.append(port_record)

            if default_item.get("ref"):
                if not default_item.get("resolved"):
                    validations.append(
                        {
                            "shipKey": hp["shipKey"],
                            "shipName": ship.get("name"),
                            "portId": port.get("id"),
                            "portName": port.get("portName"),
                            "ruleCategory": rule_category,
                            "defaultItem": default_item,
                            "status": "unresolved",
                            "matchReason": "default_ref_unresolved",
                        }
                    )
                    unresolved.append(
                        {
                            "kind": "default_ref_unresolved",
                            "shipKey": hp["shipKey"],
                            "shipName": ship.get("name"),
                            "portId": port.get("id"),
                            "ref": default_item.get("ref"),
                            "ruleCategory": rule_category,
                            "sourcePath": hp.get("sourcePath"),
                        }
                    )
                else:
                    default_key = default_lookup_key(default_item)
                    compatible_keys = {item["componentKey"].lower() for item in compatible if item.get("componentKey")}
                    if default_key and default_key in compatible_keys:
                        match = next(item for item in compatible if item.get("componentKey", "").lower() == default_key)
                        validations.append(
                            {
                                "shipKey": hp["shipKey"],
                                "shipName": ship.get("name"),
                                "portId": port.get("id"),
                                "portName": port.get("portName"),
                                "ruleCategory": rule_category,
                                "defaultItem": default_item,
                                "status": "compatible",
                                "confidence": match.get("confidence"),
                                "matchReason": match.get("matchReason"),
                            }
                        )
                    else:
                        reason = classify_mismatch(port, default_item, rule_category, identity_by_key)
                        validations.append(
                            {
                                "shipKey": hp["shipKey"],
                                "shipName": ship.get("name"),
                                "portId": port.get("id"),
                                "portName": port.get("portName"),
                                "ruleCategory": rule_category,
                                "defaultItem": default_item,
                                "status": "mismatch",
                                "mismatchReason": reason,
                            }
                        )
                        unresolved.append(
                            {
                                "kind": "default_rule_mismatch",
                                "shipKey": hp["shipKey"],
                                "shipName": ship.get("name"),
                                "portId": port.get("id"),
                                "ref": default_item.get("ref"),
                                "ruleCategory": rule_category,
                                "reason": reason,
                                "sourcePath": hp.get("sourcePath"),
                            }
                        )

            if not compatible:
                unresolved.append(
                    {
                        "kind": "no_compatible_items",
                        "shipKey": hp["shipKey"],
                        "shipName": ship.get("name"),
                        "portId": port.get("id"),
                        "portName": port.get("portName"),
                        "ruleCategory": rule_category,
                        "portType": port.get("portType"),
                        "portSubType": port.get("portSubType"),
                        "minSize": port.get("minSize"),
                        "maxSize": port.get("maxSize"),
                        "sourcePath": hp.get("sourcePath"),
                    }
                )

        by_ship.append(
            {
                "shipKey": hp["shipKey"],
                "shipName": ship.get("name"),
                "sourcePath": hp.get("sourcePath"),
                "fittingRelevantPortCount": len(ship_ports),
                "compatibleMappingCount": sum(port["compatibleItemCount"] for port in ship_ports),
                "categoryCounts": dict(sorted(Counter(port["ruleCategory"] for port in ship_ports).items())),
                "ports": ship_ports,
            }
        )

    validation_counts = Counter(row["status"] for row in validations)
    mismatch_counts = Counter(row.get("mismatchReason") for row in validations if row["status"] == "mismatch")
    unresolved_by_ship = Counter(row["shipName"] or row["shipKey"] for row in unresolved)
    examples = []
    for wanted in ["Aegis Gladius", "Drake Cutlass Black", "RSI Aurora Mk I CL", "RSI Polaris", "Aegis Idris-P"]:
        ship = next((row for row in ships if wanted.lower() in (row.get("name") or "").lower()), None)
        if not ship:
            continue
        ship_ports = [row for row in by_port if row["shipKey"] == ship["shipKey"]]
        examples.append(summarize_ship(ship, ship_ports, validations))
        if len(examples) >= 4:
            break

    top_rule_gaps = [
        {"reason": reason, "count": count}
        for reason, count in mismatch_counts.most_common(20)
        if reason
    ]
    top_unresolved_ships = [
        {"shipName": ship_name, "count": count}
        for ship_name, count in unresolved_by_ship.most_common(20)
    ]

    report = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "phase": "fitting-phase-3-compatibility",
        "sourceRoots": {
            "fittingDir": str(FITTING_DIR),
            "ships": str(FITTING_DIR / "ships.json"),
            "shipHardpoints": str(FITTING_DIR / "ship_hardpoints.json"),
            "components": str(FITTING_DIR / "components.json"),
        },
        "counts": {
            "shipsProcessed": len(by_ship),
            "fittingRelevantPortsProcessed": len(by_port),
            "supportPortsExcluded": len(support_excluded),
            "compatibleItemMappings": total_mappings,
            "byCategory": dict(sorted(category_counts.items())),
            "defaultLoadoutValidation": {
                "resolvedAndCompatible": validation_counts.get("compatible", 0),
                "resolvedButRuleMismatch": validation_counts.get("mismatch", 0),
                "unresolvedDefaultRefs": validation_counts.get("unresolved", 0),
                "skippedSupportDefaultRefs": validation_counts.get("skipped_support", 0),
            },
            "confidence": dict(sorted(confidence_counts.items())),
            "unresolvedEntries": len(unresolved),
        },
        "topRuleGaps": top_rule_gaps,
        "topShipsWithUnresolvedCompatibility": top_unresolved_ships,
        "examples": examples,
        "knownGaps": [
            "Missile child ports can expose missile defaults, but Phase 2 does not yet include a dedicated missile projectile registry; rack compatibility is generated for missile rack/launcher ports.",
            "Support/interior/default items are intentionally skipped from user-facing lists and preserved in validation as skipped support refs.",
            "Turret, gimbal, and mount compatibility is split by inferred parent/child port category; bespoke ship-specific locks are reported as mismatches when current metadata cannot prove compatibility.",
            "Javelin/capital unresolved refs remain visible in compatibility_unresolved_refs.json without blocking normal ship compatibility.",
        ],
        "externalSourceUse": {"erkul": False, "spviewer": False, "manualSeeds": False},
    }

    write_json(FITTING_DIR / "fitting_rules.json", wrap("FittingCompatibilityRules", generated_at, rules))
    write_json(FITTING_DIR / "compatible_items_by_port.json", wrap("CompatibleItemsByPort", generated_at, by_port))
    write_json(FITTING_DIR / "compatible_items_by_ship.json", wrap("CompatibleItemsByShip", generated_at, by_ship))
    write_json(FITTING_DIR / "default_loadout_validation.json", wrap("DefaultLoadoutValidation", generated_at, validations))
    write_json(FITTING_DIR / "compatibility_unresolved_refs.json", wrap("CompatibilityUnresolvedRefs", generated_at, unresolved))
    write_json(FITTING_DIR / "compatibility_report.json", report)
    print(json.dumps(report["counts"], indent=2))
    print(f"wrote {FITTING_DIR}")


if __name__ == "__main__":
    main()
