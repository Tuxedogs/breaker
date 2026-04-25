# Phase 6 — Backend + Auth Plan (Deferred)

Documented here for reference. Do not implement until the frontend feature surface stabilizes.

---

## Decision: Supabase

Discord OAuth is a first-class toggle. PostgreSQL is the right fit for the relational logistics schema. RLS eliminates custom auth middleware. Free tier (500MB DB, 50K MAU) is sufficient for MVP. TypeScript client is well-maintained; types generate directly from schema.

---

## Auth Flow — Discord OAuth

1. User clicks "Login with Discord" (already in `DashboardSidebar` PRO card).
2. `supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: ... } })`
3. Discord → Supabase callback URL → session stored in localStorage.
4. `AuthContext` at app root wraps `onAuthStateChange`, exposes `{ session, user, loading }`.
5. Logistics routes redirect unauthenticated users to `/dashboard`.

**Local dev note:** Discord does not accept `localhost` as redirect URI. Use a hosted Supabase dev project for auth testing; local Docker for schema work. Or configure `http://127.0.0.1:5173` in the Discord app settings.

---

## Database Schema

```sql
-- Reference tables (seeded, not per-user)
CREATE TABLE materials (
  id         TEXT PRIMARY KEY,           -- matches mock IDs: 'stileron', 'borase', etc.
  name       TEXT NOT NULL,
  unit_type  TEXT NOT NULL CHECK (unit_type IN ('SCU', 'count', 'units')),
  category   TEXT NOT NULL CHECK (category IN ('raw', 'refined', 'component', 'consumable', 'byproduct')),
  quality    TEXT CHECK (quality IN ('low', 'medium', 'high', 'prime')),
  notes      TEXT
);

CREATE TABLE crafting_recipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name   TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('component', 'weapon', 'armor', 'consumable', 'ship_part', 'other')),
  output_qty  INTEGER NOT NULL DEFAULT 1 CHECK (output_qty > 0),
  craft_time  INTEGER NOT NULL,  -- seconds
  notes       TEXT
);

CREATE TABLE recipe_inputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity    NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  unit_type   TEXT NOT NULL CHECK (unit_type IN ('SCU', 'count', 'units'))
);

-- Per-user tables
CREATE TABLE locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  system     TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('station', 'city', 'outpost', 'ship')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id    TEXT NOT NULL REFERENCES materials(id),
  quantity       NUMERIC(12, 4) NOT NULL CHECK (quantity >= 0),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  container_name TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE build_queue_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name  TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('component', 'weapon', 'armor', 'consumable', 'ship_part', 'other')),
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status     TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'paused', 'complete', 'cancelled')),
  priority   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Notes:**
- `materials` uses string IDs matching mock data — seed script is a direct copy, `computeShortages` needs no changes.
- `inventory_entries.location_id` cascades on location delete — UI must show a confirmation before deleting a location.
- No org-level shared tables in Phase 6. Shared inventory is a Phase 7+ schema change.

---

## Row-Level Security

```sql
-- Reference tables: readable by all authenticated users, writable only via service role
ALTER TABLE materials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_inputs    ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON materials        FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all" ON crafting_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all" ON recipe_inputs    FOR SELECT TO authenticated USING (true);

-- Per-user tables: full CRUD on own rows only
ALTER TABLE locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_queue_items  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_rows" ON locations         FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_rows" ON inventory_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_rows" ON build_queue_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Important:** Never send `user_id` from the client. Omit it from insert payloads; the DB enforces it via `auth.uid()`.

---

## Environment Variables

```bash
# .env.local (gitignored)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# SUPABASE_SERVICE_ROLE_KEY goes here too, for seed scripts only
# NEVER in a VITE_ variable — never bundled to client
```

---

## Local Dev Setup

```bash
npm install @supabase/supabase-js
npx supabase login
npx supabase init
npx supabase start   # requires Docker
```

- Studio: http://localhost:54323
- Migrations: `supabase/migrations/001_schema.sql`
- Seed: `supabase/seed.sql` (reference data via service role)

---

## Migration Order (mock → backend)

1. Infrastructure: Supabase client, `AuthContext`, migrations, seed script
2. Reference data: `useMaterials`, `useRecipes` — read-only, lowest risk
3. Locations: `useLocations` — simplest user-owned resource
4. Inventory: `useInventory` — depends on locations being real first
5. Build queue: `useBuildQueue`
6. Dashboard stats: live aggregates (lowest priority)

Mock data stays until each step is confirmed working. Never a big-bang swap.

---

## Files That Will Change

**New:**
- `src/lib/supabase.ts` — client singleton
- `src/contexts/AuthContext.tsx` — auth state provider
- `src/hooks/useMaterials.ts`, `useLocations.ts`, `useInventory.ts`, `useBuildQueue.ts`
- `src/types/supabase.ts` — generated via `supabase gen types typescript`
- `supabase/migrations/001_schema.sql`
- `supabase/seed.sql`
- `.env.example`

**Modified:**
- `src/App.tsx` — wrap with `AuthContext.Provider`, add auth guard for `/logistics/*`
- `src/pages/logistics/*.tsx` — swap `useState(mockData)` for real hooks
- `src/components/dashboard/DashboardSidebar.tsx` — wire "Login with Discord" button
- `src/components/dashboard/DashboardTopBar.tsx` — real user name/avatar from `user.user_metadata`

**Untouched by Phase 6:**
- `src/lib/logistics/shortages.ts` — pure function, just fed real data
- `src/components/logistics/*` — presentation-only, no changes needed
- `src/data/mock/logistics.ts` — kept as fallback until all features confirmed live

---

## Risks

| Risk | Impact | Note |
|---|---|---|
| Discord OAuth redirect in local dev | Medium | Use hosted dev project for auth; local Docker for schema |
| Cascade delete on location removal | High UX | Confirmation dialog required before location delete |
| Type normalization (snake_case → camelCase) | Medium | Adapter layer in each hook; follow `lib/ships/adapters/` pattern |
| `user_id` never sent from client | High correctness | Omit from insert payloads; RLS enforces it |
| Session expiry handling | Medium | Every mutating hook needs 401 error handling |
| No org-level sharing | Scoped | Phase 7+ concern; don't design around it in Phase 6 |
| Free tier MAU limit (50K) | Low for now | Upgrade path to Pro ($25/mo) is straightforward |
