# Frontend status

The repository now ships a minimal but functional React dashboard in `frontend/`:

- **User flows:** login/register, ticket history, credential updates, and device profile management (presets + custom fields).
- **Admin flows:** overview with base-ticket triggers and user list/detail views. Admin routes are protected by JWT and only render when the logged-in user has the `admin` role.

Run it locally with `npm run dev:frontend` from the repo root (proxy API via `VITE_API_BASE_URL` if needed) or `npm run build:frontend` to produce a static bundle. The backend container serves the built assets under `/app` when present. See the main `README.md` for API expectations and environment variables.
