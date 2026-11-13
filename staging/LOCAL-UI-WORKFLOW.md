# Breaker staging: local-first UI testing

## Fast iteration without Vercel

1. Work only in the separate staging worktree.
2. For editing and hot reload run `npm run dev` (same as `npm run dev:isolated-ui`, localhost:5173 by default). `npm run build` and `npm run preview` are likewise the fixture build and preview; the guarded staging build is `npm run build:staging`.
3. For iPhone speed testing, run `npm run build:isolated-ui`, then `npm run preview:isolated-ui` (port 5174). Set `BREAKER_FIXTURE_LAN_IP` to an explicit private LAN IP for access from a phone on the same Wi-Fi.
4. On Tuxxy's current LAN IP `192.168.1.206`, open `http://192.168.1.206:5174/logistics/build-queue/__fixture/add-inventory?unlocked=1`.
5. The compiled preview serves a bundled, minified application, not the hundreds of unbundled Vite development modules.
6. Run `npm run test:isolated-ui`, TypeScript, lint, and mobile browser tests before release.
7. Keep local changes batched. Do not push to GitHub or request Vercel Preview deployments for each UI adjustment.

## Isolation

- `vite.config.ts` remains the strict staging Vercel build guard and is untouched.
- The separate fixture configuration reads no repository .env files, exposes no normal VITE_* values, and writes compiled files only under ignored `node_modules/.cache/breaker-local-fixtures`.
- Loopback binding is the default. The optional LAN binding accepts only an explicit private IPv4 address, not public interfaces.
- Both development and compiled preview servers return HTTP 403 for `/api` and `/auth` routes.
- A restrictive Content Security Policy forbids external API, images, and authentication. The compiled preview doesn't start a service worker; development fixtures use local mock handlers.
- Local fixtures exercise actual UI components and simulated save behavior; they cannot validate real Discord login or Neon persistence.
- Never expose the fixture preview to the public internet.

## One reviewed staging release

When the UI batch is accepted, publish only approved files to private `Tuxedogs/Breaker-staging`; then request one manual Vercel Preview in isolated `breaker-staging`. Check authenticated saves on that environment. Never push staging fixture tooling into production Breaker.
