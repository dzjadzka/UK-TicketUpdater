# Database schema overview

The downloader now uses SQLite as the primary persistence layer for production. JSON files remain available for isolated development, but ticket, credential, and history data are persisted through the following tables:

- **users**: `id`, `login` (unique), `role`, `flags` (JSON string), `device_profile`, `output_dir`, `invite_token`, `invited_by`, `locale`, timestamps, optional `email`/`password_hash`, and `is_active` flag.
- **user_credentials**: `id`, `user_id`, `uk_number`, `password_encrypted`, and the most recent login attempt fields (`last_login_status`, `last_login_error`, `last_login_at`, timestamps).
- **tickets**: `id`, `user_id`, `ticket_version`, `content_hash`, `file_path`, `downloaded_at`, `status`, `error_message`. A uniqueness constraint on `(user_id, ticket_version)` ensures one record per version per user.
- **download_history**: log of every download attempt (`user_id`, `device_profile`, `ticket_version`, `status`, `message`, `error_message`, `file_path`, `downloaded_at`) for dashboards and reporting.
- **base_ticket_state**: singleton row tracking the semester “base ticket” (`base_ticket_hash`, `effective_from`, `last_checked_at`).

Helper APIs in `src/db.js` cover:
- Inserting/updating users and NVV credentials (with login result metadata).
- Recording ticket downloads and checking for duplicate versions via `isTicketVersionNew`.
- Reading ticket history and aggregated per-user statistics.
- Managing the base ticket state so admin checks can trigger user download refreshes.

History helpers in `src/history.js` prefer the database by default and only write to JSON when no DB handle is provided.
