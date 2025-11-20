# Developer Notes
- All server endpoints are protected by the API token middleware in `src/server.js`. Requests must include `Authorization: Bearer <API_TOKEN>`, unless `ALLOW_INSECURE=true` is set for development-only use.
- Update tests when changing authentication logic to ensure `/downloads`, `/history`, and `/tickets/:userId` keep returning 401 for missing or invalid tokens.
