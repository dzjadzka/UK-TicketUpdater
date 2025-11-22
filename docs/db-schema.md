# Database schema overview

SQLite is the primary persistence layer for the downloader, API, and job system. JSON config/history files remain available for development-only scenarios, but production flows read and write through the following tables:

- **users**: Account record with `id`, `login` (unique), `role`, `flags` (JSON), `device_profile`, `output_dir`, `invite_token`, `invited_by`, `locale`, `is_active`, `auto_download_enabled`, soft-delete timestamp, `email`, `password_hash`, and timestamps.
- **invite_tokens**: Single-use registration tokens (`token`, `created_by`, `used_by`, `expires_at`, `created_at`).
- **user_credentials**: Encrypted NVV login for the downloader (`user_id` PK, `uk_number`, `uk_password_encrypted`, login telemetry fields, timestamps).
- **device_profiles**: Optional custom Puppeteer profiles bound to a user for advanced emulation (`viewport_*`, `user_agent`, locale/timezone, optional proxy/geolocation values).
- **tickets**: Persisted tickets with deduplication on `(user_id, ticket_version)`, storing `content_hash`, `file_path`, status, validation metadata, and timestamps.
- **download_history**: Every download attempt for observability dashboards (`status`, `message`, `error_message`, `device_profile`, `file_path`, `downloaded_at`).
- **base_ticket_state**: Singleton row tracking the most recent base ticket hash and change time, updated by the scheduler-driven base ticket job.
- **credentials**: General-purpose encrypted login store (currently unused by the main downloader flow) to support future integrations.

Key helper surfaces in `src/db.js`:
- User lifecycle: upsert/list active users, invite token management, soft deletion, role and flag updates.
- Credential management: read/write encrypted NVV credentials with login status updates; resolve custom device profiles per user.
- Ticket ingest: `isTicketVersionNew`, `recordTicket`, and `recordRun` for versioned storage and history logging.
- Base ticket tracking: `getBaseTicketState`/`setBaseTicketState` called by scheduler jobs to decide when to fan out downloads.

`src/history.js` prefers the database and only falls back to JSON when no DB handle is provided.
