# Backend Operations Plan (frontend deferred)

Purpose: document how the persistent backend should run, what controls exist for admins/users, and how per-user downloads are enqueued from the server. Frontend work is intentionally deferred until the backend queue and control surfaces are stable.

## High-level goals

- Keep the backend online continuously to poll the base ticket page and enqueue downloads without a separate UI.
- Give admins clear levers to trigger fleet-wide refreshes, enable/disable users, and manage device presets.
- Let users manage their own credentials and request refreshes for their tickets via the backend surface.
- Maintain minimal operational friction: clear scripts, small dependency set, and predictable storage layout.

## Backend hooks

- API server entrypoint: `npm run api` (Express in `src/server.js`) with routes for downloads, history, and tickets.
- SQLite database optional via `npm run setup:db` (creates `data/app.db`). When using JSON mode, keep compatibility but prefer DB.
- Device profiles are defined in `src/deviceProfiles.js` (desktop/mobile presets).

## Supported flows

1. **Persistent polling + queueing**
   - Keep the server process running; the polling loop should periodically touch the base ticket page and enqueue per-user jobs.
   - Jobs run sequentially today; future iterations can add concurrency controls.

2. **Admin controls**
   - Trigger a full run via `/downloads`.
   - Enable/disable users in the database and manage device presets to influence subsequent jobs.

3. **User controls**
   - Maintain credentials and per-user device profiles via the backend endpoints.
   - Request a refresh for their own ticket to place a job on the queue.

## Next documentation steps

- Keep this file aligned with backend changes; remove any references to UI-level workflows until a frontend is reintroduced.
- Add API examples (curl or HTTPie) once the polling loop cadence and job lifecycle endpoints are finalized.

# Frontend documentation archive

The previous "Frontend Improvement Plan" outlined a prospective UI that has not been implemented. That planning note now lives at `legacy/FRONTEND_IMPROVEMENT_PLAN_ARCHIVED.md` for historical reference only.

If a new UI effort starts, prefer drafting a fresh plan that reflects the current backend capabilities and avoids implying existing flows.
