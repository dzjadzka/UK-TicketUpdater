# Legacy Scripts

This directory contains the original single-user scripts that preceded the multi-user implementation.

## Files

### ticket-downloader.js

The original Firefox/Puppeteer-based single-user ticket downloader. This was the initial implementation before the multi-user refactor. Retained for reference only - **not actively maintained**.

### ticket-uploader.sh

Example bash script showing how to upload tickets to Nextcloud/WebDAV. This is a reference implementation and can be adapted for other cloud storage providers. **Not actively maintained**.

## Migration

The current implementation in `src/` provides:

- Multi-user support with configurable device profiles
- Both JSON and SQLite storage backends
- REST API for programmatic access
- Better error handling and logging

For new deployments, use the modern implementation. These legacy scripts are kept only for historical reference.
