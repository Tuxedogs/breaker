import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFittingBuildQuery,
  captureFittingApiMeta,
  getFittingBuildContext,
  getFittingBuildId,
  getFittingChannel,
  resetFittingBuildContextForTests,
  setFittingChannel,
} from "./fittingBuildContext.ts";

test.beforeEach(() => {
  resetFittingBuildContextForTests();
});

test("appendFittingBuildQuery bootstraps with channel only before buildId is known", () => {
  assert.equal(getFittingChannel(), "LIVE");
  assert.equal(getFittingBuildId(), null);
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/ships"),
    "/api/v1/fitting/ships?channel=LIVE",
  );
});

test("appendFittingBuildQuery pins channel and buildId after meta capture", () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "4.8.184.64329-12122953" });
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/components"),
    "/api/v1/fitting/components?channel=LIVE&buildId=4.8.184.64329-12122953",
  );
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/ships/abc/hardpoints?format=flat"),
    "/api/v1/fitting/ships/abc/hardpoints?format=flat&channel=LIVE&buildId=4.8.184.64329-12122953",
  );
});

test("LIVE and PTU build contexts stay isolated when switching channel", () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });
  captureFittingApiMeta({ channel: "PTU", buildId: "ptu-build" });

  assert.deepEqual(getFittingBuildContext(), { channel: "LIVE", buildId: "live-build" });
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/ships"),
    "/api/v1/fitting/ships?channel=LIVE&buildId=live-build",
  );

  setFittingChannel("PTU");
  assert.deepEqual(getFittingBuildContext(), { channel: "PTU", buildId: "ptu-build" });
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/ships"),
    "/api/v1/fitting/ships?channel=PTU&buildId=ptu-build",
  );

  setFittingChannel("LIVE");
  assert.deepEqual(getFittingBuildContext(), { channel: "LIVE", buildId: "live-build" });
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/ships"),
    "/api/v1/fitting/ships?channel=LIVE&buildId=live-build",
  );
});

test("switching to a channel without captured buildId bootstraps channel-only queries", () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });
  setFittingChannel("PTU");

  assert.equal(getFittingBuildId(), null);
  assert.equal(
    appendFittingBuildQuery("/api/v1/fitting/components"),
    "/api/v1/fitting/components?channel=PTU",
  );
});

test("captureFittingApiMeta ignores empty buildId", () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "   " });
  assert.equal(getFittingBuildId(), null);
  assert.equal(appendFittingBuildQuery("/api/v1/fitting/ships"), "/api/v1/fitting/ships?channel=LIVE");
});
