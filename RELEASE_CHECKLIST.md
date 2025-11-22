# Release Checklist

Use this checklist before cutting a new release to ensure code quality, stability, and production readiness.

## Pre-Release Validation

### 1. Code Quality

- [ ] All linting passes: `npm run lint`
- [ ] Code is properly formatted: `npm run format:check`
- [ ] No console errors or warnings in output
- [ ] ESLint reports 0 errors and 0 warnings
- [ ] Prettier reports all files properly formatted

### 2. Testing

- [ ] All backend tests pass: `npm test`
- [ ] All frontend tests pass: `npm run test:frontend`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Coverage is acceptable: `npm run test:coverage` (target: >60%)
- [ ] Manual smoke test of CLI: `npm run download:sample`
- [ ] Manual smoke test of API:
  ```bash
  JWT_SECRET=test-secret ENCRYPTION_KEY=test-key-32-bytes-long-exactly npm run api
  # In another terminal:
  curl http://localhost:3000/health
  curl http://localhost:3000/ready
  curl http://localhost:3000/metrics
  ```
- [ ] Health probe returns 200: `GET /health`
- [ ] Readiness probe returns 200: `GET /ready`
- [ ] Metrics endpoint returns Prometheus format: `GET /metrics`
- [ ] Docker image builds successfully: `docker build -t uk-ticket-updater .`
- [ ] Docker Compose starts cleanly: `docker-compose up --build`

### 3. Dependencies

- [ ] Dependencies are up to date: `npm outdated`
- [ ] No critical or high security vulnerabilities: `npm audit`
- [ ] Frontend dependencies updated: `cd frontend && npm outdated`
- [ ] Frontend has no vulnerabilities: `cd frontend && npm audit`
- [ ] `package-lock.json` is committed
- [ ] Frontend `package-lock.json` is committed

### 4. Documentation

- [ ] README.md is up to date with new features
- [ ] CHANGELOG.md has entry for this version with date
- [ ] Architecture doc (`docs/architecture.md`) reflects system design
- [ ] Operations guide (`docs/operations.md`) covers deployment scenarios
- [ ] Future work doc (`docs/future-work.md`) lists known limitations
- [ ] AGENTS.md reflects any workflow changes
- [ ] JSDoc comments are complete for new public functions
- [ ] All environment variables documented in README and `.env.example`
- [ ] API endpoints documented (README or separate API docs)

### 5. Configuration

- [ ] `.env.example` includes all required and optional variables
- [ ] Sample config files are valid: `config/users.sample.json`
- [ ] `.gitignore` excludes: `config/users.json`, `data/*.db`, `downloads/`, `.env`, `node_modules/`, `dist/`, `frontend/dist/`
- [ ] CI workflow passes on main branch
- [ ] `docker-compose.yml` uses placeholder secrets (not real credentials)
- [ ] Dockerfile builds frontend and includes in image
- [ ] Volume mounts documented for data persistence

### 6. Git Hygiene

- [ ] All changes committed with clear messages
- [ ] No sensitive data (credentials, tokens, API keys) in history
- [ ] Branch is up to date with base branch
- [ ] Version number updated in `package.json`
- [ ] Version number consistent in CHANGELOG.md
- [ ] No uncommitted changes: `git status` clean

---

## Release Readiness (Production Deployment)

This section ensures the system is ready for production deployment. Review these items before going live.

### Configuration & Secrets

**Required Environment Variables** (must be set in production):

- [ ] `JWT_SECRET` is set (≥32 characters, cryptographically random)
  ```bash
  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] `ENCRYPTION_KEY` is set (exactly 32 bytes)
  ```bash
  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64').slice(0,32))"
  ```
- [ ] `TICKET_ADMIN_USERNAME` is set (admin account for base ticket checks)
- [ ] `TICKET_ADMIN_PASSWORD` is set (admin account password)
- [ ] Verify admin credentials work by testing login manually

**Queue Backend Configuration**:

- [ ] `JOB_QUEUE_BACKEND=persistent` (recommended for production)
- [ ] `JOB_CONCURRENCY` set appropriately (default 2, adjust based on load)
- [ ] `BASE_TICKET_CHECK_INTERVAL_HOURS` configured (default 6)
- [ ] `JOBS_SCHEDULER_ENABLED=true` (unless using external scheduler)

**Rate Limiting Configuration**:

- [ ] `TICKET_RATE_LIMIT_PER_MINUTE` set (default 12, adjust based on provider)
- [ ] `AUTH_RATE_LIMIT_MAX` configured (default 300 requests per window)
- [ ] `AUTH_RATE_LIMIT_WINDOW_MS` configured (default 900000 = 15 minutes)
- [ ] Rate limits tested under load

**Storage and Paths**:

- [ ] `DB_PATH` points to persistent, backed-up volume
- [ ] `OUTPUT_ROOT` points to persistent, backed-up volume
- [ ] Database directory is writable: `mkdir -p $(dirname $DB_PATH)`
- [ ] Downloads directory is writable: `mkdir -p $OUTPUT_ROOT`
- [ ] Sufficient disk space allocated (estimate: 2MB per ticket × users × versions)

**Optional but Recommended**:

- [ ] `PORT` set if not using default 3000
- [ ] `DEFAULT_DEVICE` set if not using desktop_chrome
- [ ] `JWT_EXPIRY` configured (default 7d)
- [ ] `NODE_ENV=production` set

### Infrastructure & Monitoring

**Health Checks**:

- [ ] Load balancer configured to poll `GET /health` for liveness
- [ ] Load balancer configured to poll `GET /ready` for readiness
- [ ] Kubernetes/ECS: liveness and readiness probes configured
- [ ] Health check intervals appropriate (e.g., every 10s)
- [ ] Health check timeouts configured (e.g., 5s)
- [ ] Failed health checks trigger alerts

**Metrics and Observability**:

- [ ] Metrics endpoint `GET /metrics` scraped by Prometheus/monitoring system
- [ ] Scrape interval configured (recommended: 15-60s)
- [ ] Key metrics tracked:
  - [ ] `queue_jobs_enqueued_total`
  - [ ] `queue_jobs_completed_total`
  - [ ] `queue_jobs_failed_total`
  - [ ] `queue_jobs_pending`
  - [ ] `rate_limiter_*` metrics
- [ ] Alerts configured for:
  - [ ] High job failure rate (>10% failures in 1h)
  - [ ] Queue backup (pending jobs > 100)
  - [ ] Rate limiter drops (many 429 responses)
  - [ ] Health check failures

**Logging**:

- [ ] Logs written to stdout/stderr (for container log collection)
- [ ] Log aggregation system configured (e.g., CloudWatch, ELK, Loki)
- [ ] Log retention policy defined (recommended: 30-90 days)
- [ ] Logs searchable by request_id, user_id, job_id
- [ ] Sensitive data redacted in logs (credentials, passwords)
- [ ] Error logs trigger alerts for critical failures

**Backup and Recovery**:

- [ ] Database backup strategy defined:
  - [ ] Automated backups scheduled (daily recommended)
  - [ ] Backup retention period set (30 days minimum)
  - [ ] Backup location secure and off-site
  - [ ] Backup verification/restore tested
- [ ] Download files backup strategy:
  - [ ] Optional: separate backup for downloads/ directory
  - [ ] Or rely on on-demand re-downloads if ticket history preserved
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined
- [ ] Disaster recovery runbook documented

### Security & Access Control

**Network Security**:

- [ ] API served behind HTTPS (TLS 1.2+ with valid certificate)
- [ ] TLS termination at load balancer or reverse proxy
- [ ] Frontend served over HTTPS
- [ ] CORS configured appropriately if API and frontend on different origins
- [ ] Firewall rules restrict database access to API server only
- [ ] Outbound access to ticket.astakassel.de allowed

**Access Control**:

- [ ] Admin users created with strong passwords
- [ ] Regular users require invite tokens to register
- [ ] Password policy enforced (8+ chars, mixed case, number)
- [ ] Role-based access control tested:
  - [ ] Regular users cannot access admin endpoints
  - [ ] Users can only access their own resources
- [ ] Inactive users cannot log in (is_active flag respected)

**Secrets Management**:

- [ ] Secrets stored in secure secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Secrets not committed to Git or visible in logs
- [ ] Secret rotation process documented
- [ ] Access to secrets restricted to deployment pipeline and operators
- [ ] Audit trail for secret access

**Security Scanning**:

- [ ] CodeQL or similar security scanning in CI
- [ ] Container image scanning for vulnerabilities
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] No critical or high vulnerabilities unaddressed

### Operations & Runbooks

**Deployment Process**:

- [ ] Deployment runbook documented:
  - [ ] Pre-deployment checklist
  - [ ] Deployment steps (blue/green, rolling update, etc.)
  - [ ] Rollback procedure
  - [ ] Post-deployment validation
- [ ] Database migrations tested and documented
- [ ] Zero-downtime deployment strategy validated
- [ ] Rollback tested in staging environment

**Incident Response**:

- [ ] On-call rotation defined
- [ ] Escalation paths documented
- [ ] Runbook for common incidents:
  - [ ] API server down
  - [ ] Database connection failures
  - [ ] Job queue backup
  - [ ] Download failures (provider issues)
  - [ ] High error rates
  - [ ] Disk space exhaustion
- [ ] Incident communication plan (status page, user notifications)

**Operational Dashboards**:

- [ ] System health dashboard accessible to operators
- [ ] Real-time metrics for:
  - [ ] API request rate and latency
  - [ ] Job processing rate
  - [ ] Error rates
  - [ ] Queue depth
  - [ ] Database performance
- [ ] User-facing status page (optional but recommended)

**Capacity Planning**:

- [ ] Expected load estimated (users, downloads per day)
- [ ] Resource requirements calculated:
  - [ ] CPU: ~1-2 cores for API + jobs
  - [ ] Memory: ~512MB-1GB
  - [ ] Disk: 2MB × users × ticket versions
- [ ] Auto-scaling configured (if applicable)
- [ ] Load testing performed at 2x expected peak load

### Testing in Production-Like Environment

**Staging Environment**:

- [ ] Staging environment mirrors production (same versions, configs)
- [ ] Full deployment tested in staging first
- [ ] End-to-end flows validated in staging:
  - [ ] User registration with invite token
  - [ ] User login and JWT authentication
  - [ ] Credential setup and encryption
  - [ ] Manual download trigger
  - [ ] Scheduled base ticket check (can manually trigger)
  - [ ] Automatic per-user downloads
  - [ ] Ticket history viewing
  - [ ] Admin user management
- [ ] Performance tested in staging under load
- [ ] Failure scenarios tested:
  - [ ] Provider downtime (timeouts handled gracefully)
  - [ ] Invalid credentials (error handling correct)
  - [ ] Database connection loss (reconnects)
  - [ ] Job failures and retries

### Post-Deployment Validation

After deploying to production, verify:

- [ ] API responds: `curl https://your-domain.com/health`
- [ ] Readiness check passes: `curl https://your-domain.com/ready`
- [ ] Frontend loads and renders correctly
- [ ] User can log in with test account
- [ ] Admin can access admin dashboard
- [ ] Metrics endpoint is being scraped
- [ ] Logs are flowing to aggregation system
- [ ] Health checks are passing in load balancer
- [ ] Scheduler is running (check logs for base ticket check)
- [ ] No critical errors in logs for first 15 minutes
- [ ] Database backups are running as scheduled

### Ongoing Operational Health

Post-release, ensure these are maintained:

- [ ] Weekly review of error logs and failed jobs
- [ ] Monthly review of disk space and database size
- [ ] Quarterly dependency updates and security patches
- [ ] Regular backup restore tests (quarterly)
- [ ] Performance monitoring for degradation trends
- [ ] User feedback channels monitored

## Release Steps

1. **Update Version**

   ```bash
   npm version [major|minor|patch]  # Updates package.json and creates git tag
   ```

2. **Generate CHANGELOG Entry**
   - Summarize changes under new version heading
   - Include Added, Changed, Fixed, Removed sections as applicable

3. **Final Validation**

   ```bash
   npm ci                    # Clean install
   npm test                  # Run all tests
   npm run lint              # Check code quality
   ```

4. **Create GitHub Release**
   - Push tag: `git push --tags`
   - Create release on GitHub with notes from CHANGELOG
   - Attach any relevant artifacts

5. **Post-Release**
   - Verify CI passes on the tagged commit
   - Monitor for issues reported by users
   - Update deployment documentation if needed

## Rollback Plan

If critical issues are discovered after release:

1. Revert the release tag
2. Fix the issue in a new branch
3. Follow the release checklist again for a patch release
4. Communicate the issue and fix to users

## Support Channels

- GitHub Issues: Report bugs and request features
- Documentation: Refer users to README and CONTRIBUTING
- Security: Email maintainers privately for security issues
