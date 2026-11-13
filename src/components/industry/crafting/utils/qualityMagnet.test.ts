import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMarkerMagnet,
  magneticQualityAtFraction,
  maxMagnetRadius,
  placeMarkerLabels,
  qualityAtTrackFraction,
} from "./qualityMagnet";

const MARKERS = [0, 400, 600, 700, 800, 900, 950, 999];

test("leaves values outside the marker radius untouched", () => {
  assert.equal(applyMarkerMagnet(450, MARKERS, 20), 450);
  assert.equal(applyMarkerMagnet(925, MARKERS, 20), 925);
});

test("holds exactly on the marker and is continuous at the radius edge", () => {
  assert.equal(applyMarkerMagnet(900, MARKERS, 20), 900);
  assert.ok(Math.abs(applyMarkerMagnet(920, MARKERS, 20) - 920) < 1e-9);
  assert.ok(Math.abs(applyMarkerMagnet(880, MARKERS, 20) - 880) < 1e-9);
  assert.ok(Math.abs(applyMarkerMagnet(919.999, MARKERS, 20) - 919.999) < 0.01);
});

test("lags the pointer near a marker without a dead zone", () => {
  const above = applyMarkerMagnet(905, MARKERS, 20);
  const below = applyMarkerMagnet(895, MARKERS, 20);
  assert.ok(above > 900 && above < 905, `expected lag above, got ${above}`);
  assert.ok(below < 900 && below > 895, `expected lag below, got ${below}`);
});

test("is strictly increasing across every marker (never traps or jumps)", () => {
  let previous = Number.NEGATIVE_INFINITY;
  for (let raw = -10; raw <= 1010; raw += 0.25) {
    const value = applyMarkerMagnet(raw, MARKERS, 24);
    assert.ok(value > previous, `not increasing at ${raw}`);
    // Bounded step: the steepest slope is 2 - grip, so no discontinuous jump.
    if (Number.isFinite(previous)) assert.ok(value - previous <= 0.25 * 2 + 1e-9, `jump at ${raw}`);
    previous = value;
  }
});

test("caps the radius so neighbouring zones never overlap", () => {
  assert.equal(maxMagnetRadius(MARKERS), 24.5);
});

test("maps the full track from the start of Band 1 through quality 1000", () => {
  assert.equal(qualityAtTrackFraction(0, 0, 1000), 0);
  assert.equal(qualityAtTrackFraction(1, 0, 1000), 1000);
  assert.equal(magneticQualityAtFraction(0, 0, 1000, MARKERS, 20), 0);
  assert.equal(magneticQualityAtFraction(1, 0, 1000, MARKERS, 20), 1000);
  assert.equal(magneticQualityAtFraction(-0.5, 0, 1000, MARKERS, 20), 0);
  assert.equal(magneticQualityAtFraction(1.5, 0, 1000, MARKERS, 20), 1000);
});

test("reaches every integer quality when dragged finely", () => {
  const reached = new Set<number>();
  for (let step = 0; step <= 100_000; step += 1) {
    reached.add(magneticQualityAtFraction(step / 100_000, 0, 1000, MARKERS, 20));
  }
  for (let quality = 0; quality <= 1000; quality += 1) {
    assert.ok(reached.has(quality), `quality ${quality} unreachable`);
  }
});

test("places crowded marker labels without overlap and never drops one", () => {
  const labels = ["330", "517", "681", "747", "874", "947", "972", "1000"];
  const width = 340;
  const travel = width - 16;
  const positions = labels.map((label) => 8 + travel * ((Number(label) - 330) / 670));
  const placements = placeMarkerLabels(positions, labels, width);
  assert.equal(placements.length, labels.length);
  for (const row of [0, 1]) {
    const spans = placements
      .map((placement, index) => ({ placement, x: positions[index], w: labels[index].length * 5.2 }))
      .filter(({ placement }) => placement.row === row)
      .map(({ placement, x, w }) => placement.anchor === "center" ? [x - w / 2, x + w / 2] : placement.anchor === "end" ? [x - w + 3, x + 3] : [x - 3, x + w - 3]);
    for (let i = 1; i < spans.length; i += 1) assert.ok(spans[i][0] >= spans[i - 1][1], `row ${row} overlap at ${i}`);
  }
  assert.ok(placements.some((placement) => placement.row === 1), "dense end markers use a second row");
  assert.deepEqual(placeMarkerLabels([8, 500], ["0", "1000"], 1000).map((p) => p.row), [0, 0]);
});
