# Expansion Plan: Multi-user Device Emulation and Persistent Backend

## Goals

- Keep a persistent backend online that polls the base ticket page, queues per-user downloads, and writes ticket files plus history.
- Support tens of concurrent users with role-based access (user/admin) and clear controls for who can trigger or manage downloads.
- Emulate logins from diverse devices (desktop/mobile variants) with optional IP/geolocation variance.
- Persist credential sets locally and store download history with ticket files.

## Recommended Architecture

- **Core service**: Node.js backend exposing APIs for user management, ticket orchestration, and history storage.
- **Storage**: Local database (SQLite for simplicity; replaceable with Postgres if scaling). Tables for users, credentials, device profiles, tickets, and download history.
- **Automation worker**: In-process queue runner executing browser sessions (Puppeteer/Playwright). Runs headless; configurable user-agents and proxy/geolocation options.
- **AuthZ model**: Roles (user/admin). Admin enables/disables users and can trigger global download runs; users manage their own credentials and can request refreshes for their tickets.

## Device Emulation Strategy

- Use browser contexts with per-job user-agent overrides (mobile/desktop presets), viewport sizing, and isolated storage (cookies/localStorage).
- Optional proxy/geo: allow per-job proxy URL to vary IP/region when required.
- Maintain per-user device profiles (name, user-agent, viewport, proxy) to reuse across runs.

## Data Model (proposed tables)

- `users`: id, email, role, is_active, created_at.
- `credentials`: id, user_id (FK), login_name, login_password, label, created_at, updated_at.
- `device_profiles`: id, user_id, name, user_agent, viewport_json, proxy_url, created_at.
- `tickets`: id, user_id, credential_id, device_profile_id, file_path, downloaded_at, status, error_text.
- `jobs`: id, user_id, credential_id, device_profile_id, status, started_at, finished_at, logs_path.

## API Surface (MVP)

- Downloads: enqueue ticket downloads for all active users or for a single user; fetch the latest ticket file.
- Credentials: create/read/update/delete (owner-only; admin can list all).
- Device profiles: CRUD per user.
- History: list runs and filter by user/device/profile.
- Admin: enable/disable users, trigger full-queue runs, and monitor job state.

## Phased Implementation Plan

1. **Foundation (Backend + Storage)**
   - Keep the Express service running persistently with SQLite migrations for the tables above.
   - Add credential CRUD endpoints (passwords encrypted at rest) and device profile management.
2. **Automation Layer**
   - Wire a polling loop that checks the base ticket and enqueues per-user jobs on a cadence.
   - Execute jobs through Puppeteer/Playwright with device presets and optional proxy support.
   - Persist tickets to disk under per-user directories; record metadata/history in DB.
3. **History + Files**
   - API to list history with filters (date range, status, device) and download ticket file. Store files and metadata locally.
4. **Ops & Security Hardening**
   - Add environment-based config, basic rate limiting, password hashing, and minimal logging/metrics. Containerize with Docker for reproducibility.

## Notes & Assumptions

- Resources unconstrained but target tens of concurrent users; SQLite acceptable initially.
- No quotas/limits required; history retention defaults to full storage unless manually purged.
- Headless mode acceptable; device emulation should stay configurable without needing a frontend.
- No GDPR/other compliance constraints provided; keep secrets local and avoid committing credentials.
