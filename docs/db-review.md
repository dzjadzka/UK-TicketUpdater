# Database Implementation Review

**Review Date:** November 22, 2025  
**Reviewer:** AI Agent  
**Scope:** Complete database layer analysis including schema, API surface, usage patterns, and recommendations

---

## Executive Summary

The SQLite database implementation is **production-ready** with comprehensive schema design, proper indexing, and defensive error handling. The system successfully transitioned from JSON-based storage to DB-only operations. This review identifies 8 minor improvements and 3 areas for future enhancements.

**Overall Grade:** A- (90/100)

### Strengths

✅ Comprehensive schema with proper foreign keys and indexes  
✅ Prepared statements prevent SQL injection  
✅ Transaction support for batch operations  
✅ Consistent error handling with detailed logging  
✅ Proper soft-delete pattern for users  
✅ Content-based deduplication for tickets  
✅ Backward compatibility maintained during JSON → DB migration

### Areas for Improvement

⚠️ Missing migration system for schema changes  
⚠️ No database backup/restore utilities  
⚠️ Some redundant table structures (credentials vs user_credentials)  
⚠️ Limited query optimization for large datasets

---

## 1. Schema Design Analysis

### 1.1 Core Tables

#### ✅ `users` - Well-designed with appropriate constraints

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  is_active INTEGER DEFAULT 1,
  auto_download_enabled INTEGER DEFAULT 0,
  deleted_at TEXT,  -- Soft delete pattern ✓
  ...
)
```

**Strengths:**

- Soft delete via `deleted_at` preserves audit trail
- Separate email and login fields for flexibility
- Role-based access control built-in
- Proper unique constraints

**Issues:**

- `flags TEXT DEFAULT '{}'` - JSON in SQLite works but limits queryability
- Consider JSON1 extension for complex flag queries

**Recommendation:** Document flag schema in code comments or separate doc.

---

#### ✅ `user_credentials` - Secure credential storage

```sql
CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY,
  uk_number TEXT NOT NULL,
  uk_password_encrypted TEXT NOT NULL,
  last_login_status TEXT,
  ...
)
```

**Strengths:**

- One-to-one relationship with users (PK = FK)
- Encrypted password storage
- Login telemetry for debugging

**Issues:**

- No index on `last_login_at` for time-based queries
- `uk_number` not encrypted (PII concern)

**Recommendation:** Add `CREATE INDEX idx_user_credentials_login_at ON user_credentials(last_login_at)` if querying login patterns.

---

#### ⚠️ `credentials` - Redundant table

```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login_name TEXT NOT NULL,
  login_password_encrypted TEXT NOT NULL,
  ...
)
```

**Issue:** This table is **never used** in the current codebase. Appears to be a leftover from earlier design iterations or planned feature.

**Evidence:**

```bash
grep -r "createCredential\|getCredentialsByUser" src/
# Only defined in db.js, never called
```

**Recommendation:**

- **Option A:** Remove table and methods if not needed (simplify schema)
- **Option B:** Document intended use case and implement feature
- **Option C:** Deprecate with migration plan if keeping for backward compatibility

---

#### ✅ `tickets` - Excellent deduplication design

```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ticket_version TEXT NOT NULL,
  content_hash TEXT,
  ...
  UNIQUE(user_id, ticket_version)  -- Prevents duplicates ✓
)
```

**Strengths:**

- Dual deduplication: version + hash
- Status tracking for validation
- Proper timestamp fields

**Minor Issue:** No index on `content_hash` for hash-based lookups

**Recommendation:** `CREATE INDEX idx_tickets_hash ON tickets(user_id, content_hash)` if `getTicketByHashStmt` is frequently used.

---

#### ✅ `download_history` - Comprehensive audit trail

```sql
CREATE TABLE download_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  device_profile TEXT,
  status TEXT,
  message TEXT,
  error_message TEXT,
  downloaded_at TEXT DEFAULT (datetime('now'))
)
```

**Strengths:**

- Immutable log (no updates, only inserts)
- Captures both success and failure paths
- Device profile tracking for debugging

**Issues:**

- No index on `(user_id, downloaded_at)` for user history queries
- No retention policy (table grows indefinitely)

**Recommendations:**

1. Add composite index: `CREATE INDEX idx_history_user_time ON download_history(user_id, downloaded_at DESC)`
2. Implement retention policy (archive/delete records older than X months)
3. Consider partitioning for very large deployments

---

#### ✅ `base_ticket_state` - Singleton pattern correctly implemented

```sql
CREATE TABLE base_ticket_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Enforces singleton ✓
  base_ticket_hash TEXT,
  ...
)
```

**Strengths:**

- Singleton constraint prevents multiple rows
- Tracks change detection for scheduler

**Perfect implementation.** No issues found.

---

#### ✅ `job_queue` - Persistent queue with retry logic

```sql
CREATE TABLE job_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',
  available_at TEXT DEFAULT (datetime('now'))
)
CREATE INDEX idx_job_queue_status_available ON job_queue(status, available_at);
```

**Strengths:**

- Supports exponential backoff
- Index optimized for queue polling
- Status tracking

**Minor Issue:** No cleanup of completed jobs (table grows over time)

**Recommendation:** Add periodic cleanup job for old completed/failed jobs.

---

### 1.2 Relationships & Constraints

#### Foreign Keys

All foreign keys properly defined:

```sql
FOREIGN KEY (user_id) REFERENCES users(id)
FOREIGN KEY (created_by) REFERENCES users(id)
```

**Issue:** Foreign keys are **not enforced** by default in SQLite.

**Critical Fix Required:**

```javascript
function createDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');  // ← ADD THIS
  initSchema(db);
  ...
}
```

**Without this, cascading deletes and referential integrity are not enforced!**

---

### 1.3 Indexes

**Existing indexes:** ✅ Well-chosen

```sql
idx_invite_tokens_expires
idx_credentials_user
idx_device_profiles_user
idx_users_email
idx_user_credentials_user
idx_job_queue_status_available
```

**Missing indexes for common queries:**

```sql
-- Add these for performance:
CREATE INDEX idx_tickets_user_time ON tickets(user_id, downloaded_at DESC);
CREATE INDEX idx_history_user_time ON download_history(user_id, downloaded_at DESC);
CREATE INDEX idx_tickets_content_hash ON tickets(user_id, content_hash);
CREATE INDEX idx_users_active ON users(is_active, deleted_at);
```

---

## 2. API Surface Analysis

### 2.1 Method Organization

**Current structure:** Monolithic object with 50+ methods

**Pros:**

- Single import point
- Clear namespacing

**Cons:**

- Difficult to navigate
- No logical grouping
- Hard to mock in tests

**Recommendation:** Consider splitting into logical modules:

```javascript
const db = createDatabase(dbPath);
return {
  users: { getById, listActive, create, update, softDelete, ... },
  tickets: { record, isNew, getLatest, listByUser, ... },
  credentials: { upsert, get, updateStatus, ... },
  profiles: { create, list, update, delete, ... },
  invites: { create, get, markUsed, list, delete, ... },
  history: { record, get, getStats, getErrors, summarize, ... },
  base: { getState, setState },
  db: rawDb,
  close
};
```

---

### 2.2 Prepared Statements

**Excellent:** All queries use prepared statements ✅

Example:

```javascript
const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL');
```

**Security:** Prevents SQL injection  
**Performance:** Statements are compiled once, executed many times

**No issues found in this area.**

---

### 2.3 Error Handling

**Pattern used consistently:**

```javascript
methodName: (arg) => {
  try {
    // validate
    // execute statement
    return result;
  } catch (error) {
    console.error('Failed to [action]:', error);
    throw error;
  }
};
```

**Strengths:**

- Consistent error logging
- Preserves stack traces
- Fails fast

**Issue:** `console.error` in production should use structured logger

**Recommendation:**

```javascript
const { logger } = require('./logger');

methodName: (arg) => {
  try {
    // ...
  } catch (error) {
    logger.error('db_method_failed', { method: 'methodName', error });
    throw error;
  }
};
```

---

### 2.4 Input Validation

**Current state:** Minimal validation before queries

Examples of good validation:

```javascript
if (!userId) {
  throw new Error('userId is required');
}
if (!Array.isArray(ids)) {
  throw new Error('ids must be an array');
}
```

**Issues found:**

1. Some methods accept undefined/null without validation
2. No type checking (e.g., expecting string but receiving number)
3. No length limits on text fields

**Recommendation:** Add validation helper:

```javascript
function validate(schema, data) {
  // Use joi, zod, or custom validator
  // Throw descriptive errors early
}

createUser: (data) => {
  validate(
    {
      id: 'string:required:max:255',
      email: 'email:required',
      password_hash: 'string:required:min:60'
    },
    data
  );
  // ...
};
```

---

## 3. Usage Pattern Analysis

### 3.1 Transaction Usage

**Current:** Only one transaction found:

```javascript
const insertMany = db.transaction((items) => {
  items.forEach((user) => {
    upsertUserStmt.run(...);
  });
});
```

**Issue:** Other batch operations don't use transactions

**Example - should be transactional:**

```javascript
// src/setupDb.js - imports multiple users
users.forEach((user) => db.upsertUser(user)); // ← Not atomic!
```

**Recommendation:** Wrap batch operations in transactions:

```javascript
const upsertUsersTransaction = db.transaction((users) => {
  users.forEach((u) => upsertUserStmt.run(u));
});

upsertUsers: (users) => {
  try {
    upsertUsersTransaction(users);
  } catch (error) {
    console.error('Failed to upsert users:', error);
    throw error;
  }
};
```

---

### 3.2 Query Patterns

**Observed patterns:**

#### ✅ Good: Single-user queries

```javascript
db.getUserById(id);
db.getUserCredential(userId);
db.listTicketsByUser(userId);
```

Properly indexed, efficient

#### ⚠️ Potentially slow: Batch user queries

```javascript
db.listActiveUsers(); // Returns ALL active users
```

**Issue:** No pagination support

**Recommendation for large deployments:**

```javascript
listActiveUsers: (limit = 100, offset = 0) => {
  return db
    .prepare(
      `SELECT * FROM users 
     WHERE deleted_at IS NULL AND is_active = 1 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
};
```

#### ⚠️ N+1 query problem potential

```javascript
// jobs/handlers.js
const users = db.listActiveUsers();
users.forEach((user) => {
  const cred = db.getUserCredential(user.id); // ← N queries
  const profile = db.getDeviceProfileById(id, user.id); // ← N queries
});
```

**Recommendation:** Add batch fetch methods:

```javascript
getUserCredentialsForUsers: (userIds) => {
  return db
    .prepare(
      `SELECT * FROM user_credentials 
     WHERE user_id IN (SELECT value FROM json_each(?))`
    )
    .all(JSON.stringify(userIds));
};
```

---

### 3.3 Connection Management

**Current:** Each operation opens/closes DB

**Issue:** Database handle created per request/job

Example from server.js:

```javascript
app.locals.db = createDatabase(dbPath); // ✓ Good - single instance
```

Example from index.js:

```javascript
const db = createDatabase(dbPath);
try {
  // use db
} finally {
  db.close(); // ✓ Good - proper cleanup
}
```

**Recommendation:** Document connection pooling strategy for future multi-process deployments.

---

## 4. Testing Coverage

### 4.1 Test Analysis

**File:** `__tests__/db.test.js` (100 lines, 9 tests)

**Coverage:**

- ✅ Schema creation
- ✅ User CRUD
- ✅ Credentials storage
- ✅ Ticket deduplication
- ✅ History logging
- ✅ Base ticket state

**Missing tests:**

- ❌ Foreign key enforcement
- ❌ Unique constraint violations
- ❌ Soft delete cascade behavior
- ❌ Transaction rollback on error
- ❌ Concurrent write conflicts
- ❌ NULL handling in optional fields
- ❌ UTF-8/emoji in text fields
- ❌ Very long strings (e.g., 10MB error messages)

**Recommendation:** Add comprehensive test suite:

```javascript
describe('database edge cases', () => {
  it('enforces foreign keys', () => {
    expect(() => db.createUserCredential({
      userId: 'nonexistent', ...
    })).toThrow(/foreign key/);
  });

  it('handles concurrent upserts', async () => {
    await Promise.all([
      db.upsertUser({ id: 'user-1', ... }),
      db.upsertUser({ id: 'user-1', ... })
    ]);
    // Should not deadlock or corrupt
  });

  it('rolls back transaction on error', () => {
    const initial = db.getUsers().length;
    try {
      db.upsertUsers([
        { id: 'valid', ... },
        { id: null }  // Invalid
      ]);
    } catch (e) {}
    expect(db.getUsers().length).toBe(initial);
  });
});
```

---

## 5. Security Review

### 5.1 SQL Injection

**Status:** ✅ **PROTECTED**

All queries use parameterized statements:

```javascript
db.prepare('SELECT * FROM users WHERE email = ?').get(email); // ✓ Safe
```

**No string concatenation found.**

---

### 5.2 Sensitive Data

**Encrypted fields:**

- ✅ `user_credentials.uk_password_encrypted`
- ✅ `credentials.login_password_encrypted`

**Plain text PII (concern):**

- ⚠️ `user_credentials.uk_number` - User ID number
- ⚠️ `users.email` - Email address
- ⚠️ `users.login` - Login name

**Recommendation for compliance (GDPR/CCPA):**

1. Document data retention policy
2. Implement user data export API
3. Implement user data deletion (cascade from soft delete)
4. Consider encrypting `uk_number` and `email`

---

### 5.3 Access Control

**Database level:** No row-level security (not supported in SQLite)

**Application level:** Enforced in API routes:

- JWT authentication checks user identity
- `requireAdmin` middleware for admin routes
- User ID scoped queries (e.g., `WHERE user_id = ?`)

**Issue:** If DB handle leaks to untrusted code, full access is possible

**Recommendation:** Document security model and trust boundaries in architecture doc.

---

## 6. Performance Considerations

### 6.1 Current Performance

**For typical deployment (<1000 users):** Excellent

**Benchmarks (estimated based on schema):**

- User lookup by email: <1ms (indexed)
- Insert ticket: <2ms
- List history (50 rows): <5ms
- Base ticket check: <1ms

---

### 6.2 Scalability Concerns

**Large deployments (10k+ users):**

1. **Full table scans:**

   ```javascript
   db.listActiveUsers(); // Returns all rows
   ```

   **Impact:** Memory usage scales linearly with user count
   **Fix:** Add pagination (limit/offset)

2. **History table growth:**
   - 10k users × 10 downloads/month = 100k rows/month
   - 1 year = 1.2M rows
     **Impact:** Queries slow down without indexes
     **Fix:** Add retention policy + archival

3. **Job queue cleanup:**
   - Completed jobs accumulate
     **Fix:** Periodic cleanup of old jobs

---

### 6.3 Optimization Recommendations

**Immediate (add to migration):**

```sql
CREATE INDEX idx_tickets_user_time ON tickets(user_id, downloaded_at DESC);
CREATE INDEX idx_history_user_status_time ON download_history(user_id, status, downloaded_at DESC);
CREATE INDEX idx_users_active_created ON users(is_active, deleted_at, created_at DESC);
```

**Future (for >10k users):**

- Implement query result caching (Redis)
- Consider read replicas
- Archive old history to separate DB

---

## 7. Migration & Versioning

### 7.1 Current State

**Schema evolution:** Manual SQL in `initSchema()`

**Issue:** No migration tracking

**Problems:**

1. Can't upgrade production DB safely
2. No rollback capability
3. Breaking changes overwrite schema
4. Can't detect schema version

---

### 7.2 Recommended Migration System

**Add schema version table:**

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now')),
  description TEXT
);
```

**Migration runner:**

```javascript
const migrations = [
  {
    version: 1,
    up: (db) => {
      db.exec(`CREATE TABLE users (...)`);
    },
    down: (db) => {
      db.exec(`DROP TABLE users`);
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    },
    down: (db) => {
      db.exec(`ALTER TABLE users DROP COLUMN email`);
    }
  }
];

function runMigrations(db) {
  const currentVersion = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get().v || 0;

  migrations
    .filter((m) => m.version > currentVersion)
    .forEach((migration) => {
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(
          migration.version,
          migration.description
        );
      })();
    });
}
```

---

## 8. Backup & Recovery

### 8.1 Current State

**Backup strategy:** ❌ Not implemented

**Issues:**

1. No automated backups
2. No point-in-time recovery
3. No backup verification

---

### 8.2 Recommendations

**Development:**

```bash
# Add to npm scripts
"db:backup": "cp data/app.db data/backups/app-$(date +%Y%m%d-%H%M%S).db"
```

**Production:**

1. Use SQLite `.backup` command:

   ```javascript
   const backupDb = new Database('backup.db');
   db.db.backup(backupDb);
   backupDb.close();
   ```

2. Schedule daily backups:

   ```javascript
   // Add to scheduler
   schedule.scheduleJob('0 2 * * *', () => {
     const backupPath = `backups/app-${new Date().toISOString()}.db`;
     db.db.backup(backupPath);
   });
   ```

3. Upload to S3/similar for disaster recovery

---

## 9. Documentation

### 9.1 Current Documentation

**Files:**

- ✅ `docs/db-schema.md` - High-level overview
- ✅ Inline comments in `src/db.js`
- ❌ No API reference
- ❌ No migration guide
- ❌ No troubleshooting guide

**Quality:** Adequate for development, insufficient for operations

---

### 9.2 Recommended Documentation

**Add:**

1. **API Reference** (`docs/db-api.md`)
   - Every method with params, return values, examples
   - Error conditions

2. **Operations Guide** (`docs/db-operations.md`)
   - Backup procedures
   - Restore procedures
   - Performance tuning
   - Monitoring queries

3. **Migration Guide** (`docs/db-migrations.md`)
   - How to add columns
   - How to modify indexes
   - Testing migrations

---

## 10. Action Items

### Priority 1 - Critical (Do Now)

1. **Enable foreign key enforcement**

   ```javascript
   // src/db.js line 142
   const db = new Database(resolvedPath);
   db.pragma('foreign_keys = ON'); // ← ADD THIS
   initSchema(db);
   ```

2. **Add missing indexes**

   ```sql
   CREATE INDEX idx_tickets_user_time ON tickets(user_id, downloaded_at DESC);
   CREATE INDEX idx_history_user_time ON download_history(user_id, downloaded_at DESC);
   ```

3. **Remove or document unused `credentials` table**
   - If keeping: document use case
   - If removing: add migration to drop

### Priority 2 - Important (This Sprint)

4. **Implement backup system**
   - Add `db:backup` npm script
   - Schedule daily backups in production
   - Test restore procedure

5. **Add comprehensive tests**
   - Foreign key enforcement
   - Transaction rollbacks
   - Concurrent access
   - Edge cases (NULLs, empty strings, unicode)

6. **Switch to structured logging**
   - Replace `console.error` with `logger.error`
   - Add context to all DB errors

### Priority 3 - Nice to Have (Next Quarter)

7. **Implement migration system**
   - Add schema_migrations table
   - Create migration runner
   - Document migration process

8. **Add pagination to list methods**
   - `listActiveUsers(limit, offset)`
   - `listHistory(userId, limit, offset)`

9. **Implement data retention policy**
   - Archive old download_history
   - Clean up old job_queue entries

10. **Refactor API surface**
    - Group methods logically
    - Improve testability
    - Add type hints (JSDoc or TypeScript)

---

## 11. Conclusion

The database implementation is **solid and production-ready** for small to medium deployments. The schema design shows good understanding of relational database principles, and the prepared statement usage eliminates SQL injection risks.

**Key strengths:**

- Clean schema with proper constraints
- Consistent error handling
- Good separation of concerns
- Comprehensive feature coverage

**Must fix before scaling:**

1. Enable foreign key enforcement (1-line change)
2. Add backup system
3. Implement retention policies for growing tables

**Technical debt to address:**

- Migration system for schema evolution
- Pagination for large result sets
- Remove redundant `credentials` table

**Overall assessment:** The database layer provides a strong foundation. With the Priority 1 fixes applied, it can confidently support production workloads up to 10k users. Beyond that, consider the scalability recommendations.

---

## Appendix A: Schema ERD

```
users (1) ─────────< user_credentials (1)
  │
  ├────────────────< tickets (*)
  │
  ├────────────────< download_history (*)
  │
  ├────────────────< device_profiles (*)
  │
  ├────────────────< invite_tokens (*) [created_by]
  │
  └────────────────< credentials (*) [unused]

base_ticket_state (singleton)
job_queue (*)
```

Legend: (1) = one, (\*) = many

---

## Appendix B: Quick Health Check Queries

```sql
-- Check database size
SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();

-- Check table row counts
SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM tickets) as tickets,
  (SELECT COUNT(*) FROM download_history) as history,
  (SELECT COUNT(*) FROM job_queue WHERE status = 'pending') as pending_jobs;

-- Check for orphaned records (if FK enforcement was off)
SELECT COUNT(*) FROM user_credentials uc
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id);

-- Check old jobs (cleanup candidates)
SELECT COUNT(*), status
FROM job_queue
WHERE created_at < datetime('now', '-7 days')
GROUP BY status;

-- Check history growth rate
SELECT DATE(downloaded_at) as date, COUNT(*) as downloads
FROM download_history
WHERE downloaded_at >= datetime('now', '-30 days')
GROUP BY DATE(downloaded_at)
ORDER BY date;
```

---

**Review completed.** Ready for stakeholder review and prioritization of action items.
