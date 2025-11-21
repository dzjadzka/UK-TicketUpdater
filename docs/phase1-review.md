# Phase 1 Review Report

## 1. Summary
- Core modules for auth, downloads, and SQLite persistence exist, and admin/user routes are wired into `src/server.js`.
- SQLite schema and helper surface are incomplete/contradictory (duplicate tables/columns, broken registration insert, unused base-ticket state).
- Download flow still depends on legacy username/password fields rather than the new encrypted UK credential store, so the Phase 1 multi-user path is not coherent.
- Documentation overstates current functionality (polling loop, base ticket tracking, queueing) compared to the implemented backend.

## 2. Legacy / Hygiene Issues
- **Legacy claims in README:** README still advertises a persistent polling backend and queued downloads that are not implemented in `src/server.js` (no scheduler/loop). Update the README to reflect the current Phase 1 scope and defer polling/queueing to later phases.【F:README.md†L6-L21】【F:src/server.js†L104-L641】

## 3. Auth & Security Issues
- **High – Broken registration insert & undefined variable:** `createUser` references an undefined `login` variable and the prepared insert `createUserStmt` omits the required `login` column, so `/auth/register` will throw or fail at runtime. Add the missing parameter, use `email` (or a dedicated login field) consistently, and include it in the INSERT columns.【F:src/db.js†L140-L210】【F:src/db.js†L542-L559】
- **High – Duplicate `is_active` column:** The `users` schema defines `is_active` twice, which can corrupt schema state or hide updates. Remove the duplicate column and normalize flags before further migrations.【F:src/db.js†L13-L32】
- **High – Duplicate `user_credentials` table definitions:** Two conflicting `user_credentials` CREATE TABLE blocks exist (one with `password_encrypted`, another with `uk_password_encrypted` and different primary keys). Consolidate into a single definition that matches the new UK credential model to avoid schema creation errors and ambiguous queries.【F:src/db.js†L43-L66】
- **Medium – Admin download endpoint ignores user status:** `/downloads` pulls `db.getUsers()` (including deleted/disabled users) and does not filter by `is_active` or `deleted_at`. Limit downloads to active, non-deleted users to honor admin controls and avoid processing stale accounts.【F:src/server.js†L704-L739】【F:src/db.js†L147-L210】
- **Medium – Password handling mismatch on login:** `/auth/login` accepts `user.password` (legacy plain text) if `password_hash` is absent, risking accidental storage/use of plaintext passwords. Consider migrating/validating legacy records and rejecting non-hashed entries in the new model.【F:src/server.js†L240-L274】

## 4. Data Model & History Issues
- **High – User creation impossible with current schema:** Because `createUserStmt` lacks the mandatory `login` column while the table requires it, new users cannot be inserted, blocking the core auth flow. Align the schema and insert statements on required fields.【F:src/db.js†L13-L32】【F:src/db.js†L542-L559】
- **High – UK credential storage unused in downloader:** The ticket downloader still expects `user.username`/`user.password` properties and never reads the encrypted `user_credentials` table populated via `/me/credentials`. This breaks the envisioned multi-user credential separation. Wire the downloader to decrypt and use `user_credentials` (and enforce presence) instead of legacy inline fields.【F:src/downloader.js†L101-L187】【F:src/server.js†L294-L339】【F:src/db.js†L16-L66】【F:src/db.js†L240-L320】
- **Medium – Base ticket state unused:** The schema includes `base_ticket_state`, but no server logic reads/writes it or triggers checks for updates, so the Phase 1 “base ticket” tracking is inert. Implement minimal read/write helpers and route/cron hooks or remove from Phase 1 docs until supported.【F:src/db.js†L113-L119】【F:src/server.js†L104-L641】
- **Medium – Duplicate persistence fields:** Overlapping columns (`username` vs `login`, duplicated `is_active`, two credential table variants) create ambiguity for migrations and API responses. Rationalize field names and drop duplicates before Phase 2 to avoid data drift.【F:src/db.js†L13-L66】【F:src/db.js†L147-L210】

## 5. Docs vs Code Mismatches
- **Polling/queueing not implemented:** README claims a persistent polling loop that “enqueues per-user downloads,” but `src/server.js` only exposes immediate admin-triggered downloads and no scheduler. Update README and docs to clarify current manual-trigger-only behavior.【F:README.md†L6-L21】【F:src/server.js†L674-L741】
- **Base ticket tracking undocumented in code:** Docs describe base ticket detection and duplicate-version checks, yet no route or workflow touches `base_ticket_state` or uses ticket versions/hashes in downloads. Either document this as future work or add minimal endpoints for the stored state.【F:docs/db-schema.md†L5-L22】【F:src/db.js†L85-L119】【F:src/downloader.js†L101-L226】
- **Auth environment variables:** README omits `JWT_EXPIRY` and the dev default behavior for `JWT_SECRET`/`ENCRYPTION_KEY`; code allows weak defaults outside production. Document required secrets and recommended settings to prevent insecure deployments.【F:README.md†L23-L40】【F:src/auth.js†L1-L86】

## 6. Critical Follow-Ups Before Phase 2
1. **Fix schema and registration flow:** Remove duplicate columns/tables, add the `login` column to `createUserStmt`, and ensure `/auth/register` inserts consistent user data (id, login/email, role, flags, active state).【F:src/db.js†L13-L66】【F:src/db.js†L542-L559】
2. **Connect downloader to encrypted UK credentials:** Read/decrypt `user_credentials` for each user, enforce presence before downloads, and stop relying on legacy inline passwords so downloads use the secured store.【F:src/downloader.js†L101-L187】【F:src/server.js†L294-L339】【F:src/db.js†L43-L66】
3. **Restrict operational routes to active users:** Ensure `/downloads` and admin listings respect `is_active`/`deleted_at` flags to prevent actions on disabled accounts.【F:src/server.js†L382-L417】【F:src/server.js†L704-L739】【F:src/db.js†L147-L210】
4. **Clarify documentation vs current capabilities:** Rewrite README/docs to remove claims of polling/queueing/base-ticket automation until implemented, and add missing env var requirements for auth/encryption settings.【F:README.md†L6-L40】【F:docs/db-schema.md†L5-L22】【F:src/auth.js†L1-L86】
