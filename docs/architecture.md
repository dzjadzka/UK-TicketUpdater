# Architecture Overview

This document provides a high-level overview of the UK-TicketUpdater system architecture, key components, and data flows.

## System Purpose

UK-TicketUpdater is a multi-user automation system that:
- Periodically monitors NVV semester tickets for changes
- Automatically downloads updated tickets for registered users
- Provides a web UI and API for user management and ticket access
- Handles authentication, credential encryption, and job scheduling

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend (Vite)          │  CLI Tools                    │
│  - User dashboard                │  - npm run download           │
│  - Admin panel                   │  - npm run download:db        │
│  - Device profile management     │  - npm run setup:db           │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ HTTP/REST (JWT)                    │ Direct DB Access
             │                                    │
┌────────────▼────────────────────────────────────▼───────────────┐
│                      API Server Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Express Server (src/server.js)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authentication & Authorization (JWT)                      │  │
│  │  - Invite-only registration                               │  │
│  │  - Role-based access (admin/user)                         │  │
│  │  - Bcrypt password hashing                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Rate Limiting & Security                                  │  │
│  │  - Per-IP global limiter (100 req/15min)                  │  │
│  │  - Per-user authenticated limiter (300 req/15min)         │  │
│  │  - Outbound provider rate limiter (12 req/min)            │  │
│  │  - Security headers (HSTS, X-Frame-Options, etc.)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ API Routes                                                │  │
│  │  User Routes:                                             │  │
│  │    - POST /auth/register (with invite token)              │  │
│  │    - POST /auth/login                                     │  │
│  │    - GET/PUT /me (profile & credentials)                  │  │
│  │    - GET /me/tickets (personal history)                   │  │
│  │    - GET /downloads, /history, /tickets/:userId           │  │
│  │  Admin Routes:                                            │  │
│  │    - GET /admin/users (list/search)                       │  │
│  │    - POST /admin/invites (generate tokens)                │  │
│  │    - POST /admin/jobs/* (manual job triggers)             │  │
│  │    - GET /admin/observability/* (errors, metrics)         │  │
│  │  Health & Metrics:                                        │  │
│  │    - GET /health (liveness)                               │  │
│  │    - GET /ready (readiness: DB + queue)                   │  │
│  │    - GET /metrics (Prometheus format)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Enqueues Jobs
             │
┌────────────▼────────────────────────────────────────────────────┐
│                   Background Job System                         │
├─────────────────────────────────────────────────────────────────┤
│  Job Scheduler (src/jobs/scheduler.js)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Periodic Base Ticket Check                                │  │
│  │  - Interval: BASE_TICKET_CHECK_INTERVAL_HOURS (default 6h)│  │
│  │  - Triggers downloadTicketsForAllUsers on hash change     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Job Queue (memory or SQLite-backed persistent)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Queue Configuration                                        │  │
│  │  - Backend: JOB_QUEUE_BACKEND (memory|persistent)         │  │
│  │  - Concurrency: JOB_CONCURRENCY (default 2)               │  │
│  │  - Retry: 3 attempts with exponential backoff             │  │
│  │  - Dead letter tracking for permanent failures            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Job Handlers (src/jobs/handlers.js)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. checkBaseTicket                                         │  │
│  │    - Login with admin credentials                          │  │
│  │    - Download base ticket HTML                             │  │
│  │    - Compute SHA-256 hash                                  │  │
│  │    - Compare with stored hash                              │  │
│  │    - Update base_ticket_state table                        │  │
│  │    - Enqueue downloadTicketsForAllUsers if changed         │  │
│  │                                                             │  │
│  │ 2. downloadTicketsForAllUsers                              │  │
│  │    - Query all active users with auto_download_enabled     │  │
│  │    - Enqueue downloadTicketForUser for each user           │  │
│  │                                                             │  │
│  │ 3. downloadTicketForUser                                   │  │
│  │    - Decrypt user UK credentials                           │  │
│  │    - Load device profile (preset or custom)                │  │
│  │    - Launch Puppeteer with device emulation                │  │
│  │    - Login to ticket.astakassel.de                         │  │
│  │    - Download ticket HTML                                  │  │
│  │    - Compute content hash for deduplication                │  │
│  │    - Save to disk if new version detected                  │  │
│  │    - Record run in download_history table                  │  │
│  │    - Update tickets table with version info                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Reads/Writes
             │
┌────────────▼────────────────────────────────────────────────────┐
│                   Data Persistence Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  SQLite Database (src/db.js)                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tables:                                                    │  │
│  │  - users: Account records with roles and settings         │  │
│  │  - invite_tokens: Single-use registration tokens          │  │
│  │  - user_credentials: Encrypted NVV login credentials      │  │
│  │  - device_profiles: Custom Puppeteer configs              │  │
│  │  - tickets: Versioned ticket storage with deduplication   │  │
│  │  - download_history: Download attempts and outcomes       │  │
│  │  - base_ticket_state: Current base ticket hash & time     │  │
│  │  - job_queue: Persistent queue state (when enabled)       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  File System (downloads/)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Structure: downloads/<user-id>/<timestamp>_ticket.html    │  │
│  │  - Organized by user ID                                    │  │
│  │  - Timestamped for version tracking                        │  │
│  │  - Content-hash based deduplication                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      External Systems                           │
├─────────────────────────────────────────────────────────────────┤
│  Ticket Provider (ticket.astakassel.de)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Login endpoint                                           │  │
│  │ - Ticket download endpoint                                 │  │
│  │ - Rate limited: 12 requests/minute (configurable)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Puppeteer Browser                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Chromium/Chrome instances                                │  │
│  │ - Device emulation (viewport, user-agent, locale)          │  │
│  │ - Optional proxy and geolocation override                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Server (`src/server.js`)
**Purpose**: Provides REST API for all client interactions

**Key Features**:
- JWT-based authentication with invite-only registration
- Role-based access control (admin/user)
- Per-IP and per-user rate limiting
- Security headers and audit logging
- Health and readiness probes for orchestrators
- Prometheus-compatible metrics endpoint

**Environment Configuration**:
- `JWT_SECRET`: JWT signing key (required in production)
- `ENCRYPTION_KEY`: AES-256 key for credential encryption (required)
- `PORT`: Server port (default 3000)
- `AUTH_RATE_LIMIT_MAX`: Per-user request limit (default 300)
- `AUTH_RATE_LIMIT_WINDOW_MS`: Rate limit window (default 15 minutes)

### 2. Background Job System (`src/jobs/`)
**Purpose**: Handles scheduled and on-demand ticket downloads

**Components**:
- **Scheduler** (`scheduler.js`): Periodic base ticket checks
- **Queue** (`queue.js`, `persistentQueue.js`): Job queuing with concurrency control
- **Handlers** (`handlers.js`): Job execution logic

**Job Types**:
1. **checkBaseTicket**: Detects changes to the base ticket
2. **downloadTicketsForAllUsers**: Fan-out job enqueuing per-user downloads
3. **downloadTicketForUser**: Individual user ticket download

**Queue Features**:
- Two backends: in-memory (dev) or SQLite-backed (production)
- Configurable concurrency to avoid overwhelming provider
- Retry logic with exponential backoff (3 attempts)
- Dead letter queue for permanently failed jobs
- Metrics tracking: enqueued, completed, failed, retries

**Environment Configuration**:
- `JOB_QUEUE_BACKEND`: `memory` or `persistent` (default: persistent when DB available)
- `JOB_CONCURRENCY`: Max parallel jobs (default 2)
- `BASE_TICKET_CHECK_INTERVAL_HOURS`: Scheduler interval (default 6)
- `JOBS_SCHEDULER_ENABLED`: Enable/disable scheduler (default true)
- `TICKET_ADMIN_USERNAME`: Admin account for base ticket checks
- `TICKET_ADMIN_PASSWORD`: Admin account password

### 3. Downloader (`src/downloader.js`)
**Purpose**: Puppeteer-based ticket download automation

**Features**:
- Device profile emulation (viewport, user-agent, timezone, locale)
- Custom device profiles with proxy and geolocation support
- Session management and authentication
- Content extraction and validation
- Browser cleanup and resource management

**Device Profiles** (`src/deviceProfiles.js`):
- Preset profiles: `desktop_chrome`, `mobile_android`, `iphone_13`, `iphone_15_pro`, `desktop_firefox`, `mac_safari`, `tablet_ipad`
- Custom profiles: User-defined with proxy/geolocation/timezone

**Environment Configuration**:
- `DEFAULT_DEVICE`: Default device profile (default: desktop_chrome)
- `PUPPETEER_SKIP_DOWNLOAD`: Skip Chromium download during install
- `TICKET_RATE_LIMIT_PER_MINUTE`: Outbound rate limit (default 12)
- `TICKET_RATE_LIMIT_WINDOW_MS`: Rate limit window (default 60000)

### 4. Database Layer (`src/db.js`)
**Purpose**: SQLite persistence for all system data

**Key Operations**:
- User management (CRUD, soft delete, role/flag updates)
- Invite token generation and validation
- Credential encryption/decryption (AES-256-GCM)
- Device profile management
- Ticket versioning and deduplication
- Download history tracking
- Base ticket state management

**Environment Configuration**:
- `DB_PATH`: SQLite database file path (default: ./data/app.db)
- `OUTPUT_ROOT`: Base directory for downloads (default: ./downloads)

### 5. Frontend (`frontend/src/`)
**Purpose**: React-based web UI for users and admins

**Pages**:
- **User Pages**: Login, Register, Dashboard, Profile, Credentials, Device Profiles, Tickets, History, Downloads
- **Admin Pages**: Overview, User Management, User Detail, Manual Job Triggers

**Features**:
- JWT authentication with secure token storage
- Role-based route protection
- CRUD interfaces for credentials and device profiles
- Download history and ticket viewing
- Admin observability dashboards

**Environment Configuration**:
- `VITE_API_BASE_URL`: API base URL (default: /api for reverse proxy)

### 6. Rate Limiter (`src/rateLimiter.js`)
**Purpose**: Multi-level rate limiting and traffic control

**Limiters**:
1. **Global IP Limiter**: 100 requests per 15 minutes per IP
2. **Authenticated User Limiter**: 300 requests per 15 minutes per user
3. **Provider Rate Limiter**: Token bucket for outbound calls (12/min default)

**Features**:
- In-memory sliding window counters
- Token bucket algorithm for outbound rate limiting
- Configurable via environment variables

### 7. Logger (`src/logger.js`)
**Purpose**: Structured JSON logging with credential redaction

**Features**:
- Severity levels: INFO, WARN, ERROR
- Request ID tracking for correlation
- Automatic credential field redaction
- Context enrichment (user_id, route, method, status, duration)

## Data Flows

### Flow 1: User Registration and Login

```
1. Admin generates invite token
   POST /admin/invites → creates invite_tokens record

2. User accepts invite and registers
   POST /auth/register (with token)
   → validates token
   → hashes password with bcrypt
   → creates user record
   → marks token as used
   → returns JWT

3. User logs in
   POST /auth/login (email + password)
   → verifies password hash
   → checks user is_active flag
   → generates JWT with user_id + role
   → returns JWT

4. Protected API calls
   Any authenticated endpoint
   → verifies JWT signature
   → extracts user_id and role
   → checks authorization
   → processes request
```

### Flow 2: Credential and Device Profile Management

```
1. User adds UK credentials
   PUT /me/credentials (uk_number + uk_password)
   → encrypts password with AES-256-GCM
   → stores in user_credentials table
   → enables auto_download if requested

2. User creates custom device profile
   POST /device-profiles
   → validates profile fields (viewport, user-agent, proxy, geolocation)
   → stores in device_profiles table
   → profile associated with user_id

3. Downloader loads profile
   downloadTicketForUser job
   → queries user_credentials (decrypts password)
   → loads device profile (preset or custom UUID)
   → configures Puppeteer with profile settings
   → launches browser with device emulation
```

### Flow 3: Automated Base Ticket Check and Download Cascade

```
1. Scheduler triggers base ticket check (every 6 hours)
   JobScheduler.start()
   → enqueues checkBaseTicket job
   → waits BASE_TICKET_CHECK_INTERVAL_HOURS

2. Base ticket check executes
   checkBaseTicket handler
   → decrypts admin credentials (TICKET_ADMIN_USERNAME/PASSWORD)
   → launches Puppeteer with rate limiting
   → logs into ticket.astakassel.de
   → downloads base ticket HTML
   → computes SHA-256 hash
   → queries base_ticket_state table
   → compares new hash with stored hash

3. If ticket changed
   → updates base_ticket_state with new hash + timestamp
   → enqueues downloadTicketsForAllUsers job
   → records event in audit logs

4. Download fan-out
   downloadTicketsForAllUsers handler
   → queries users where is_active=1 AND auto_download_enabled=1
   → enqueues downloadTicketForUser(userId) for each user

5. Per-user download
   downloadTicketForUser handler (runs with JOB_CONCURRENCY limit)
   → decrypts user UK credentials
   → loads device profile
   → launches Puppeteer with device emulation
   → logs into ticket.astakassel.de with user credentials
   → downloads user ticket HTML
   → computes content hash
   → checks if hash is new (isTicketVersionNew)
   → if new: saves to downloads/<user-id>/<timestamp>_ticket.html
   → records ticket in tickets table
   → records run in download_history table
   → updates user_credentials.last_login_at
```

### Flow 4: Manual Download via API

```
1. User triggers download from UI
   POST /downloads (authenticated)
   → verifies user has credentials
   → enqueues downloadTicketForUser(user_id) job
   → returns 202 Accepted

2. Job executes asynchronously
   (same as Flow 3, step 5)

3. User checks history
   GET /me/tickets or GET /history
   → queries download_history for user_id
   → returns list of attempts with status/timestamps
```

### Flow 5: Observability and Monitoring

```
1. Health checks
   GET /health → returns 200 OK (liveness)
   GET /ready → checks DB connection + queue metrics (readiness)

2. Metrics scraping
   GET /metrics (Prometheus format)
   → queue_jobs_enqueued_total
   → queue_jobs_completed_total
   → queue_jobs_failed_total
   → queue_jobs_retries_total
   → queue_jobs_pending
   → rate_limiter_* metrics

3. Admin observability
   GET /admin/observability/errors
   → recent download failures from download_history
   
   GET /admin/observability/job-summary
   → job statistics over last N hours
   
   GET /admin/observability/base-ticket
   → current base ticket hash and last check time
   
   GET /admin/observability/queue
   → queue backend, pending/running counts, retry/failure counters
```

### Flow 6: Rate Limiting

```
1. Inbound API rate limiting
   Every API request
   → global IP limiter checks (100 req/15min per IP)
   → if authenticated: user limiter checks (300 req/15min per user_id)
   → if exceeded: returns 429 Too Many Requests
   → if allowed: processes request

2. Outbound provider rate limiting
   Every download job (checkBaseTicket, downloadTicketForUser)
   → acquires token from bucket (12 tokens/minute)
   → if no tokens: waits until token available
   → makes request to ticket.astakassel.de
   → replenishes tokens at steady rate
```

## Security Architecture

### Authentication & Authorization
- **Invite-Only Registration**: Prevents open signups, tokens expire and are single-use
- **JWT Tokens**: Stateless authentication, configurable expiry (default 7 days)
- **Role-Based Access**: Admin/user roles with middleware enforcement
- **Password Security**: Bcrypt hashing (10 rounds), strength validation (8+ chars, mixed case, number)

### Data Protection
- **Credential Encryption**: AES-256-GCM for UK passwords at rest
- **Secure Key Management**: `ENCRYPTION_KEY` from environment, 32-byte requirement
- **Credential Redaction**: Logger automatically redacts sensitive fields
- **No Plaintext Secrets**: All secrets from environment variables

### Network Security
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **Rate Limiting**: Multi-level protection (IP, user, outbound)
- **Request Tracking**: Unique request IDs for audit trail
- **TLS Termination**: Expected from reverse proxy in production

### Audit Logging
- **User Actions**: Registration, login, credential updates, device profile changes
- **Admin Actions**: Invite creation, user management, manual job triggers
- **Job Events**: Job enqueue, start, complete, fail, retry
- **Structured Logs**: JSON format with context enrichment

## Deployment Considerations

### Docker Deployment
- **Multi-stage build**: Slim production image (~200MB)
- **Frontend bundled**: React build served at `/app` by backend
- **Persistent volumes**: Mount `./data` and `./downloads`
- **Environment secrets**: Pass via docker-compose or orchestrator
- **Queue backend**: Use `JOB_QUEUE_BACKEND=persistent` for restart safety

### High Availability
- **Stateless API**: JWT auth enables horizontal scaling
- **Queue persistence**: SQLite-backed queue survives restarts
- **Health probes**: `/health` (liveness) and `/ready` (readiness)
- **Graceful degradation**: Scheduler disabled if `JOBS_SCHEDULER_ENABLED=false`

### Limitations
- **Single-instance queue**: SQLite queue not designed for multi-instance deployments
- **In-process rate limiting**: Rate limits not shared across API instances
- **File storage**: Downloads stored locally, not distributed

**Multi-instance considerations**: For true HA, externalize queue (Redis/BullMQ) and rate limiting (Redis), and use shared storage (NFS/S3) for downloads.

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Database**: SQLite (better-sqlite3)
- **Job Queue**: In-memory or SQLite-backed
- **Authentication**: JWT (jsonwebtoken), bcrypt
- **Encryption**: Built-in Node.js crypto (AES-256-GCM)
- **Browser Automation**: Puppeteer 22+
- **Testing**: Jest 29, Playwright

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **State Management**: React Context
- **HTTP Client**: Fetch API
- **Testing**: Vitest, React Testing Library

### DevOps
- **CI/CD**: GitHub Actions (lint, test, e2e)
- **Linting**: ESLint 9 (flat config)
- **Formatting**: Prettier
- **Containerization**: Docker + Docker Compose

## Performance Characteristics

### Scalability
- **Concurrent downloads**: Limited by `JOB_CONCURRENCY` (default 2)
- **API throughput**: Rate limited at 100 req/15min per IP
- **Database**: SQLite suitable for 100s of users, 1000s of tickets

### Resource Usage
- **Memory**: ~200-300MB per Node.js process (API + scheduler)
- **Disk**: ~1-2MB per ticket HTML, plus SQLite overhead
- **CPU**: Spiky during Puppeteer launches, idle otherwise

### Optimization Opportunities
- **Browser reuse**: Currently launches new browser per download
- **Caching**: No response caching, could cache user profiles
- **CDN**: Static frontend assets could be CDN-hosted
- **Connection pooling**: SQLite handles in-memory, no pooling needed

## Further Reading

- [Operations Guide](./operations.md) - Runtime configuration and observability
- [Database Schema](./db-schema.md) - Table definitions and relationships
- [Release Checklist](../RELEASE_CHECKLIST.md) - Pre-deployment validation steps
- [CHANGELOG](../CHANGELOG.md) - Version history and feature additions
