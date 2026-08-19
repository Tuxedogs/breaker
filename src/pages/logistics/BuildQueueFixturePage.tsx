import { Navigate } from "react-router-dom";

import BuildQueuePage from "./BuildQueuePage";
import {
  buildQueueMockupFixture,
  buildQueueStatsFixture,
  buildQueueTargetFixture,
} from "./buildQueueStatsFixture";

export default function BuildQueueFixturePage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/logistics/build-queue" replace />;
  }

  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("target") === "1"
    ? buildQueueTargetFixture
    : params.get("mockup") === "1"
      ? buildQueueMockupFixture
      : buildQueueStatsFixture;

  return <BuildQueuePage fixture={fixture} />;
}
