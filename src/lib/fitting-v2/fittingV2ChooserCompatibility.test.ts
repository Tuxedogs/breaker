import assert from "node:assert/strict";
import test from "node:test";
import { isFittingV2TargetPotentiallyActionable } from "./fittingV2ChooserCompatibility";
import type { FittingV2Target } from "./fittingV2SlotTopology";

const target = (overrides: Partial<FittingV2Target> = {}): FittingV2Target => ({ portId: "cooler-1", parentPortId: null, tab: "components", installedComponentId: null, structural: { editable: true, locked: false, bespoke: false }, constraint: { type: "Cooler", subtype: null, minSize: 3, maxSize: 3, exactSize: 3 }, compatibilityPortId: "cooler-1", replacement: "single-port", ...overrides });

test("editable exact-port targets are eligible to request a chooser", () => assert.equal(isFittingV2TargetPotentiallyActionable(target()), true));
test("informational PDC-style targets do not request a chooser", () => assert.equal(isFittingV2TargetPotentiallyActionable(target({ replacement: "informational" })), false));
test("an empty editable slot remains chooser-eligible", () => assert.equal(isFittingV2TargetPotentiallyActionable(target({ installedComponentId: null })), true));
