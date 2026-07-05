import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getQualityTierFromBand } from "../../src/components/industry/crafting/utils/qualityBands";

describe("getQualityTierFromBand", () => {
  it("maps quality bands to shared tier keys", () => {
    assert.equal(getQualityTierFromBand(1), "common");
    assert.equal(getQualityTierFromBand(2), "common");
    assert.equal(getQualityTierFromBand(3), "rare");
    assert.equal(getQualityTierFromBand(4), "rare");
    assert.equal(getQualityTierFromBand(5), "epic");
    assert.equal(getQualityTierFromBand(6), "epic");
    assert.equal(getQualityTierFromBand(7), "legendary");
    assert.equal(getQualityTierFromBand(8), "legendary");
  });

  it("falls back to common for invalid bands", () => {
    assert.equal(getQualityTierFromBand(null), "common");
    assert.equal(getQualityTierFromBand(undefined), "common");
    assert.equal(getQualityTierFromBand(0), "common");
    assert.equal(getQualityTierFromBand(99), "common");
  });
});
