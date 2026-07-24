import { Navigate } from "react-router-dom";

import BuildQueuePage from "./BuildQueuePage";
import { buildQueueMockupFixture, buildQueueStatsFixture } from "./buildQueueStatsFixture";

export default function BuildQueueFixturePage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/logistics/build-queue" replace />;
  }

  const fixture = new URLSearchParams(window.location.search).get("mockup") === "1"
    ? buildQueueMockupFixture
    : buildQueueStatsFixture;

  return <BuildQueuePage fixture={fixture} />;
}
