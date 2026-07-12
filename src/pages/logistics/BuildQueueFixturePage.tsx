import { Navigate } from "react-router-dom";

import BuildQueuePage from "./BuildQueuePage";
import { buildQueueStatsFixture } from "./buildQueueStatsFixture";

export default function BuildQueueFixturePage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/logistics/build-queue" replace />;
  }

  return <BuildQueuePage fixture={buildQueueStatsFixture} />;
}
