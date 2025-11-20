# Code Review

## Overview

This repository automates downloading a semester ticket via Puppeteer/Firefox and optionally uploads it to a Nextcloud WebDAV endpoint. The codebase is small but handles credentials and network automation, so security and resiliency are important.

## Strengths

- Straightforward flow that logs in, revisits the ticket site, and saves the resulting HTML for downstream use.【F:ticket-downloader.js†L18-L67】
- Uses `networkidle2` waits and explicit selectors to reduce race conditions during navigation.【F:ticket-downloader.js†L18-L59】

## Key Issues & Recommendations

1. **Hardcoded credentials and output paths (High)**
   - The downloader embeds the UK number and password directly in source control and resolves a fixed output path/filename, which exposes secrets and makes the script inflexible across environments.【F:ticket-downloader.js†L21-L23】【F:ticket-downloader.js†L85-L88】
   - The uploader script also hardcodes WebDAV credentials and the ticket path, exposing secrets and coupling the script to a single deployment setup.【F:ticket-uploader.sh†L3-L12】
   - _Recommendation:_ Read sensitive values (credentials, output path/filename, endpoint URL) from environment variables or a config file outside version control. Fail fast if required env vars are missing and document the configuration in the README.

2. **Limited error handling and observability (Medium)**
   - The main download logic wraps only the second navigation in a `try/catch` and swallows errors with a generic log, so login failures or selector timeouts are not visible to automation systems.【F:ticket-downloader.js†L32-L90】
   - Navigation and selector waits assume success; timeouts or HTTP errors are not surfaced or retried, and the script writes a generic error HTML instead of exiting non‑zero, which can hide failures in cron jobs.【F:ticket-downloader.js†L67-L90】
   - _Recommendation:_ Add structured logging with meaningful messages around each navigation/selector action, and exit with a non‑zero code on failure. Consider retries for transient network errors and emit metrics or status files to signal success/failure to cron.

3. **Resource handling and browser lifecycle (Low)**
   - Additional pages (`page2`, `page3`) are created but never closed, relying on `browser.close()` to clean up; this is acceptable for single runs but can leak resources if expanded to multiple iterations or extended flows.【F:ticket-downloader.js†L35-L67】
   - _Recommendation:_ Explicitly close pages after use or reuse a single page with conditional logic to reduce overhead and future‑proof the script.

4. **Uploader robustness and security (Medium)**
   - The upload step uses `wget` with basic auth over the provided URL without verifying TLS options or handling failures; if the request fails, the script continues silently because the exit code is not checked.【F:ticket-uploader.sh†L3-L12】
   - _Recommendation:_ Enable `set -euo pipefail`, verify TLS certificates, and check the exit status of the upload. Consider switching to `curl --fail --silent --show-error --upload-file` and log success/failure clearly.

5. **Documentation accuracy (Low)**
   - README notes switching to Firefox but installation steps still suggest Chromium dependencies indirectly; it does not describe required environment variables or how to configure the new browser dependency.【F:README.md†L1-L43】
   - _Recommendation:_ Update the README with Firefox/Puppeteer requirements, configuration via env vars, and an example `.env`/systemd service or cron entry that handles secrets securely.

## Suggested Next Steps

- Externalize all secrets and file paths to environment variables and validate them at startup.
- Harden the automation with better error handling, retries, and explicit exit codes to make cron executions reliable.
- Improve security of the upload step (TLS verification, fail-fast, optional token-based auth).
- Refresh documentation to reflect Firefox usage and new configuration model.
