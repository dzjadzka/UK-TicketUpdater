# Expansion Plan: Multi-user, Device Emulation, and Future Frontend

## Goals
- Support tens of concurrent users with role-based access (user/admin) and invitation-only onboarding.
- Emulate logins from diverse devices (desktop/mobile variants) with optional IP/geolocation variance.
- Persist credential sets locally and store download history with ticket files.
- Lay groundwork for a future frontend that allows registration (by invite), credential management, and history viewing (EN/DE UI).
- Select best-fit browser automation stack (Puppeteer/Playwright) with headless capability.

## Recommended Architecture
- **Core service**: Node.js backend exposing APIs for user management, ticket retrieval orchestration, and history storage.
- **Storage**: Local database (SQLite for simplicity; replaceable with Postgres if scaling). Tables for users, roles, sessions/device profiles, tickets, and download history.
- **Automation worker**: Queue-driven job runner executing browser sessions (prefer Playwright for multi-browser/device support; Chromium default, Firefox optional). Runs headless; configurable user-agents and proxy/geolocation options.
- **AuthZ model**: Roles (user/admin). Admin manages invites and user lifecycle; users manage own credentials and triggers.
- **Frontend stub (future)**: SPA-ready API surface; invite acceptance + login, credential CRUD, history view.

## Device Emulation Strategy
- Use Playwright contexts with per-job user-agent overrides (mobile/desktop presets), viewport sizing, and isolated storage (cookies/localStorage).
- Optional proxy/geo: allow per-job proxy URL to vary IP/region when required.
- Maintain per-user device profiles (name, user-agent, viewport, proxy) to reuse across runs.

## Data Model (proposed tables)
- `users`: id, email, password_hash, role, invite_token, invited_by, locale (en/de), created_at.
- `credentials`: id, user_id (FK), login_name, login_password, label, created_at, updated_at.
- `device_profiles`: id, user_id, name, user_agent, viewport_json, proxy_url, created_at.
- `tickets`: id, user_id, credential_id, device_profile_id, file_path, downloaded_at, status, error_text.
- `jobs`: id, user_id, credential_id, device_profile_id, status, started_at, finished_at, logs_path.

## API Surface (MVP)
- Auth: invite accept, login, refresh tokens.
- Credentials: create/read/update/delete (owner-only; admin can list all).
- Device profiles: CRUD per user.
- Jobs: enqueue ticket download for a credential+device; fetch status/history; download ticket file.
- Admin: issue/revoke invites; list users; disable user.

## Frontend Outline (future)
- Framework: lightweight React/Vite (agent-friendly) consuming JSON APIs.
- Pages: invite acceptance + signup (EN/DE), login, dashboard (credentials list), device profiles, history (status, timestamp, device, link to ticket file), settings (locale).
- Auth: token-based (store in httpOnly cookie or memory + CSRF token for safety).

## Phased Implementation Plan
1) **Foundation (Backend + Storage)**
   - Add Node.js service scaffold (Express/Fastify) with SQLite via Prisma/knex; migrations for proposed tables.
   - Implement role-based auth (JWT or session) and invite flow (admin-generated tokens).
   - Add credential CRUD endpoints (passwords encrypted at rest with key stored locally; even if requirement is minimal, prefer basic protection).
2) **Automation Layer**
   - Introduce Playwright worker with job queue (BullMQ/Redis-lite or in-process queue if simple). Each job selects browser/device profile and runs headless.
   - Implement user-agent presets (common mobile/desktop) and proxy support per job.
   - Persist tickets to disk under per-user directories; record metadata/history in DB.
3) **History + Files**
   - API to list history with filters (date range, status, device) and download ticket file. Store files and metadata locally.
4) **Frontend (Phase 2)**
   - Build invite/signup/login flows; credential/device CRUD; job trigger and history views (EN/DE localization with i18n library).
5) **Ops & Security Hardening**
   - Add environment-based config, basic rate limiting, password hashing (bcrypt/argon2), and minimal logging/metrics. Containerize with Docker for reproducibility.

## Notes & Assumptions
- Resources unconstrained but target tens of concurrent users; SQLite acceptable initially.
- No quotas/limits required; history retention defaults to full storage unless manually purged.
- Headless mode acceptable; choose Playwright for richer device emulation and multi-browser support.
- No GDPR/other compliance constraints provided; keep secrets local and avoid committing credentials.
