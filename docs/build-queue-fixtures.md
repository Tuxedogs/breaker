# Build Queue API fixtures

Run `npm run dev:fixtures`, then open `http://localhost:5173/logistics/build-queue/__fixture/stats`.

Fixture mode is development-only and displays a persistent runtime indicator. MSW intercepts the production clients' normal request URLs. Any unhandled `/api/` request throws instead of reaching Scintel, Neon, or Supabase.

`npm run ui:build-queue` starts Vite in fixture mode and is the deterministic visual validation command. Its request counts are fixture-only and must not be used as production-network performance measurements.

A future production-network performance command should start a production build or preview with MSW disabled (for example, `npm run build` followed by a dedicated `ui:build-queue:network` preview test). That command must assert the fixture indicator is absent before recording request counts. No real-network performance command is added by this fixture task.
