const { JobQueue, JobStatus, JobType } = require('../src/jobs');
const { createDatabase } = require('../src/db');
const { encrypt } = require('../src/auth');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue({}),
      waitForSelector: jest.fn().mockResolvedValue({}),
      type: jest.fn().mockResolvedValue({}),
      click: jest.fn().mockResolvedValue({}),
      content: jest.fn().mockResolvedValue('<html>NVV-Semesterticket</html>'),
      close: jest.fn().mockResolvedValue({})
    }),
    close: jest.fn().mockResolvedValue({})
  })
}));

describe('JobQueue', () => {
  let tempDir;
  let dbPath;
  let db;
  let jobQueue;
  let outputDir;

  beforeEach(() => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-test-'));
    dbPath = path.join(tempDir, 'test.db');
    outputDir = path.join(tempDir, 'downloads');
    fs.mkdirSync(outputDir, { recursive: true });

    // Create test database
    db = createDatabase(dbPath);

    // Set up encryption key for tests
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';

    // Create job queue
    jobQueue = new JobQueue({
      maxConcurrency: 2,
      maxRetries: 1,
      db,
      outputRoot: outputDir,
      defaultDeviceProfile: 'desktop_chrome'
    });
  });

  afterEach(async () => {
    // Wait a bit for any async job processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (db && db.db) {
      db.db.close();
    }
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('enqueue', () => {
    it('should enqueue a job and return jobId', () => {
      const jobId = jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'test-user' });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = jobQueue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job.type).toBe(JobType.DOWNLOAD_TICKET_FOR_USER);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.data).toEqual({ userId: 'test-user' });
    });

    it('should create job record in database', () => {
      const jobId = jobQueue.enqueue(JobType.CHECK_BASE_TICKET, { adminUserId: 'admin-1' });

      const jobFromDb = db.getJobById(jobId);
      expect(jobFromDb).toBeDefined();
      expect(jobFromDb.type).toBe(JobType.CHECK_BASE_TICKET);
      expect(jobFromDb.status).toBe(JobStatus.PENDING);
    });
  });

  describe('getJob', () => {
    it('should return job by id', () => {
      const jobId = jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-1' });
      const job = jobQueue.getJob(jobId);

      expect(job).toBeDefined();
      expect(job.id).toBe(jobId);
      expect(job.type).toBe(JobType.DOWNLOAD_TICKET_FOR_USER);
    });

    it('should return null for non-existent job', () => {
      const job = jobQueue.getJob('non-existent-id');
      expect(job).toBeNull();
    });
  });

  describe('listJobs', () => {
    it('should list all jobs', () => {
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-1' });
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-2' });
      jobQueue.enqueue(JobType.CHECK_BASE_TICKET, { adminUserId: 'admin-1' });

      const jobs = jobQueue.listJobs();
      expect(jobs.length).toBe(3);
    });

    it('should filter jobs by type', () => {
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-1' });
      jobQueue.enqueue(JobType.CHECK_BASE_TICKET, { adminUserId: 'admin-1' });

      const jobs = jobQueue.listJobs({ type: JobType.CHECK_BASE_TICKET });
      expect(jobs.length).toBe(1);
      expect(jobs[0].type).toBe(JobType.CHECK_BASE_TICKET);
    });

    it('should filter jobs by status', () => {
      const jobId1 = jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-1' });
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-2' });

      // Manually set one job to completed
      const job = jobQueue.getJob(jobId1);
      job.status = JobStatus.COMPLETED;

      const pendingJobs = jobQueue.listJobs({ status: JobStatus.PENDING });
      expect(pendingJobs.length).toBe(1);
    });

    it('should limit number of jobs returned', () => {
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-1' });
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-2' });
      jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, { userId: 'user-3' });

      const jobs = jobQueue.listJobs({ limit: 2 });
      expect(jobs.length).toBe(2);
    });
  });

  describe('executeDownloadTicketForUser', () => {
    it('should fail when user not found', async () => {
      await expect(
        jobQueue.executeDownloadTicketForUser({ userId: 'non-existent-user' })
      ).rejects.toThrow('User non-existent-user not found or not active');
    });

    it('should fail when user credentials not configured', async () => {
      // Create user without credentials (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: false
      });

      await expect(jobQueue.executeDownloadTicketForUser({ userId: 'user-1' })).rejects.toThrow(
        'UK credentials not configured for user user-1'
      );
    });

    it('should successfully execute download for user with credentials', async () => {
      // Create active user (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      });

      // Add UK credentials
      const encryptedPassword = encrypt('password123', process.env.ENCRYPTION_KEY);
      db.upsertUserCredential({ userId: 'user-1', ukNumber: '12345', ukPasswordEncrypted: encryptedPassword });

      const result = await jobQueue.executeDownloadTicketForUser({ userId: 'user-1' });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('executeCheckBaseTicket', () => {
    it('should fail when adminUserId not provided', async () => {
      await expect(jobQueue.executeCheckBaseTicket({})).rejects.toThrow('adminUserId required');
    });

    it('should fail when admin user not found', async () => {
      await expect(jobQueue.executeCheckBaseTicket({ adminUserId: 'non-existent' })).rejects.toThrow(
        'Admin user not found or invalid'
      );
    });

    it('should fail when user is not admin', async () => {
      // Create regular user (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: false
      });

      await expect(jobQueue.executeCheckBaseTicket({ adminUserId: 'user-1' })).rejects.toThrow(
        'Admin user not found or invalid'
      );
    });

    it('should fail when admin credentials not configured', async () => {
      // Create admin user without UK credentials (login required)
      db.createUser({
        id: 'admin-1',
        login: 'adminlogin',
        email: 'admin@test.com',
        passwordHash: 'hashedPassword',
        role: 'admin',
        isActive: 1,
        autoDownloadEnabled: false
      });

      await expect(jobQueue.executeCheckBaseTicket({ adminUserId: 'admin-1' })).rejects.toThrow(
        'Admin UK credentials not configured'
      );
    });

    it('should successfully check base ticket and enqueue user jobs on change', async () => {
      // Create admin user with credentials (login required)
      db.createUser({
        id: 'admin-1',
        login: 'adminlogin',
        email: 'admin@test.com',
        passwordHash: 'hashedPassword',
        role: 'admin',
        isActive: 1,
        autoDownloadEnabled: false
      });
      const encryptedPassword = encrypt('adminPassword', process.env.ENCRYPTION_KEY);
      db.upsertUserCredential({ userId: 'admin-1', ukNumber: '99999', ukPasswordEncrypted: encryptedPassword });

      // Create some auto-download enabled users with credentials (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      });
      db.upsertUserCredential({ userId: 'user-1', ukNumber: '11111', ukPasswordEncrypted: encrypt('password1', process.env.ENCRYPTION_KEY) });

      db.createUser({
        id: 'user-2',
        login: 'user2login',
        email: 'user2@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      });
      db.upsertUserCredential({ userId: 'user-2', ukNumber: '22222', ukPasswordEncrypted: encrypt('password2', process.env.ENCRYPTION_KEY) });

      const result = await jobQueue.executeCheckBaseTicket({ adminUserId: 'admin-1' });

      expect(result).toBeDefined();
      expect(result.ticketHash).toBeDefined();
      expect(result.hasChanged).toBe(true);
      expect(result.usersEnqueued).toBe(2);
      expect(result.enqueuedJobIds).toHaveLength(2);

      // Verify base ticket state was updated
      const baseState = db.getBaseTicketState();
      expect(baseState).toBeDefined();
      expect(baseState.base_ticket_hash).toBe(result.ticketHash);
    });

    it('should not enqueue user jobs when base ticket unchanged', async () => {
      // Create admin user with credentials (login required)
      db.createUser({
        id: 'admin-1',
        login: 'adminlogin',
        email: 'admin@test.com',
        passwordHash: 'hashedPassword',
        role: 'admin',
        isActive: 1,
        autoDownloadEnabled: false
      });
      const encryptedPassword = encrypt('adminPassword', process.env.ENCRYPTION_KEY);
      db.upsertUserCredential({ userId: 'admin-1', ukNumber: '99999', ukPasswordEncrypted: encryptedPassword });

      // First check - will set base ticket
      await jobQueue.executeCheckBaseTicket({ adminUserId: 'admin-1' });

      // Create user with auto-download (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      });
      db.upsertUserCredential({ userId: 'user-1', ukNumber: '11111', ukPasswordEncrypted: encrypt('password1', process.env.ENCRYPTION_KEY) });

      // Second check - should detect no change (mocked Puppeteer returns same content)
      const result = await jobQueue.executeCheckBaseTicket({ adminUserId: 'admin-1' });

      expect(result.hasChanged).toBe(false);
      expect(result.usersEnqueued).toBe(0);
      expect(result.enqueuedJobIds).toHaveLength(0);
    });
  });

  describe('executeDownloadTicketsForAllUsers', () => {
    it('should enqueue jobs for all auto-download enabled users', async () => {
      // Create users with different auto_download settings (login required)
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      }); // auto-download enabled
      db.createUser({
        id: 'user-2',
        login: 'user2login',
        email: 'user2@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: false
      }); // auto-download disabled
      db.createUser({
        id: 'user-3',
        login: 'user3login',
        email: 'user3@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: true
      }); // auto-download enabled

      const result = await jobQueue.executeDownloadTicketsForAllUsers({ triggeredBy: 'admin' });

      expect(result.total).toBe(2);
      expect(result.enqueuedJobIds).toHaveLength(2);
    });

    it('should return empty result when no users have auto-download enabled', async () => {
      // login required
      db.createUser({
        id: 'user-1',
        login: 'user1login',
        email: 'user1@test.com',
        passwordHash: 'hashedPassword',
        role: 'user',
        isActive: 1,
        autoDownloadEnabled: false
      });

      const result = await jobQueue.executeDownloadTicketsForAllUsers({});

      expect(result.total).toBe(0);
      expect(result.enqueuedJobIds).toHaveLength(0);
    });
  });
});
