# Data directory

This folder stores runtime artifacts:
- `history.json` — appended automatically after each download run with per-user status entries.
- Per-user ticket downloads are stored under `../downloads/<user-id>/` by default (configurable via CLI).

The history file and downloads are ignored from version control; create this directory before running the downloader if it does not exist.
