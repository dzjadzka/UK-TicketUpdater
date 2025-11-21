# Archived: Frontend Improvement Plan (Unimplemented)

> Status: This roadmap captured a future-looking UI concept that was never delivered. The repository still only contains a Vite/React scaffold, so treat the items below as historical planning rather than current functionality.

Purpose: give AI agents a concrete, incremental roadmap to add a user-facing frontend (EN/DE) for invite-only registration, credential/device management, and history browsing while leveraging the existing Node.js/Express + SQLite backend.

## High-level goals

- Provide invite-only onboarding with role support (admin/user) and token-based authentication.
- Expose credential, device profile, and history management via a clean UI that calls the existing API server (or its extensions).
- Deliver a responsive UX with device presets and download triggers; show ticket files/metadata.
- Keep DX-friendly: fast dev server, clear scripts, reusable components, and basic accessibility/i18n.

## Current backend hooks to rely on

- API server entrypoint: `npm run api` (Express in `src/server.js`) with routes for downloads, history, and tickets.
- SQLite database optional via `npm run setup:db` (creates `data/app.db`). When using JSON mode, keep compatibility but prefer DB.
- Device profiles are defined in `src/deviceProfiles.js` (desktop/mobile presets).

## Proposed stack

- **Framework**: React with Vite or Next.js (pick one). Prioritize simple `npm run dev` DX and SSR only if using Next.js.
- **Styling**: Tailwind CSS or minimal CSS modules; favor low-dependency setup.
- **i18n**: `react-i18next` with EN/DE namespaces for UI copy.
- **API client**: lightweight fetch wrapper with auth token support.

## Tasks for AI agents

### 1) Scaffold frontend workspace

- Create `frontend/` with chosen framework scaffold (Vite React or Next.js). Add `npm run dev:frontend`, `npm run build:frontend`, `npm run lint:frontend` scripts at root.
- Add `.gitignore` entries for frontend build artifacts (`frontend/dist`, `.next`, etc.).
- Document install/run steps in README and AGENTS.md (mention preference for nearest AGENTS in subfolder if added).

### 2) Wire authentication (invite-only)

- Implement invite acceptance + signup page (token entry, password set, locale select). Reuse backend invite token endpoint (add if missing) and create login page.
- Store auth token securely (httpOnly cookie if backend updated; otherwise in memory + CSRF token). Add logout handling.
- Guard routes client-side; show 403/redirect for unauthenticated users.

### 3) Credential & device management UI

- Build pages/forms to list/create/update/delete credentials (login/password labels). Hook to backend endpoints (add CRUD if missing).
- Surface device profile presets from `src/deviceProfiles.js`; allow per-user custom profiles (UA, viewport, proxy). Persist via API/DB.
- Add inline validation for required fields; localize labels/help text (EN/DE).

### 4) Download triggers and status/history views

- Provide UI to trigger downloads per credential/device or bulk (calls `/downloads`). Allow overriding output directory/device per run.
- Show run history table (status, timestamp, device, message). Implement pagination or lazy load. Link to ticket files from `/tickets/:userId`.
- Add status badges/spinners for in-flight jobs; surface errors.

### 5) Ticket file access and retention controls

- Render/download ticket files (HTML) in-browser where safe; otherwise provide download link. Handle missing files gracefully.
- Add optional cleanup button or schedule configuration (TTL) surfaced to admins; call backend housekeeping endpoint if added.

### 6) Internationalization and accessibility

- Set up `react-i18next` namespaces; supply EN/DE strings for all UI text. Provide language switcher; persist preference.
- Ensure keyboard navigation and basic ARIA labels for form controls and tables.

### 7) Testing and quality gates

- Add frontend-specific lint (ESLint + Prettier config aligned with backend style) and component tests (Vitest/RTL or Jest) for core flows (auth guard, forms validation, history table rendering).
- Include `npm run test:frontend` script and document it. Update CI guidance in AGENTS.md when tests exist.

### 8) Dev/prod configuration

- Introduce `.env.frontend.example` for API base URL/token handling; ensure real secrets stay uncommitted.
- If using Next.js, configure API proxy during dev to `npm run api` port; if Vite, use `vite.config.js` proxy.
- Add basic build output notes and static asset handling.

### 9) Optional: component library and layout

- Define a minimal design system (buttons, inputs, tables, badges) to keep consistency and reduce duplication.
- Add dark/light theme toggle if time allows; ensure accessibility contrast.

## Milestones

1. **MVP shell**: scaffold + auth pages + history read-only view (EN only) calling existing API.
2. **Management phase**: credential/device CRUD + localized UI + basic tests.
3. **Ops polish**: retention controls, accessibility pass, CI hooks for frontend tests, and documentation updates.

## Risks/assumptions

- Backend auth/invite endpoints may need to be added or adjusted; coordinate contracts early.
- API token handling currently simple; hardening (httpOnly cookies/CSRF) will require backend updates.
- Headless download jobs may be slow; design UI to show async status rather than blocking.
