const crypto = require('crypto');
const { downloadTicketForUser } = require('./downloader');
const { getEncryptionKey } = require('./auth');

/**
 * Simple in-memory job queue for Phase 2
 * Supports job types: checkBaseTicket, downloadTicketForUser, downloadTicketsForAllUsers
 */

const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

const JobType = {
  CHECK_BASE_TICKET: 'checkBaseTicket',
  DOWNLOAD_TICKET_FOR_USER: 'downloadTicketForUser',
  DOWNLOAD_TICKETS_FOR_ALL_USERS: 'downloadTicketsForAllUsers'
};

class JobQueue {
  constructor(options = {}) {
    this.jobs = new Map(); // jobId -> job object
    this.pendingQueue = []; // array of jobIds waiting to run
    this.running = new Set(); // set of currently running jobIds
    this.maxConcurrency = options.maxConcurrency || 3;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    this.isProcessing = false;
    this.db = options.db;
    this.encryptionKey = options.encryptionKey || getEncryptionKey();
    this.outputRoot = options.outputRoot || './downloads';
    this.defaultDeviceProfile = options.defaultDeviceProfile || 'desktop_chrome';
  }

  /**
   * Enqueue a new job
   * @param {string} type - Job type (from JobType)
   * @param {Object} data - Job-specific data
   * @returns {string} jobId
   */
  enqueue(type, data = {}) {
    const jobId = crypto.randomBytes(16).toString('hex');
    const job = {
      id: jobId,
      type,
      data,
      status: JobStatus.PENDING,
      retries: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null
    };

    this.jobs.set(jobId, job);
    this.pendingQueue.push(jobId);

    // Record in database
    if (this.db && this.db.createJob) {
      this.db.createJob(job);
    }

    // Start processing if not already running
    this.processQueue();

    return jobId;
  }

  /**
   * Get job by ID
   * @param {string} jobId
   * @returns {Object|null}
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * List jobs with optional filtering
   * @param {Object} filter - { type, status, limit }
   * @returns {Array<Object>}
   */
  listJobs(filter = {}) {
    let jobs = Array.from(this.jobs.values());

    if (filter.type) {
      jobs = jobs.filter((j) => j.type === filter.type);
    }

    if (filter.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }

    // Sort by creation time, newest first
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filter.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Process the job queue
   */
  async processQueue() {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      while (this.pendingQueue.length > 0 || this.running.size > 0) {
        // Start new jobs up to concurrency limit
        while (this.pendingQueue.length > 0 && this.running.size < this.maxConcurrency) {
          const jobId = this.pendingQueue.shift();
          const job = this.jobs.get(jobId);

          if (!job) {
            continue;
          }

          this.running.add(jobId);
          this.executeJob(job).finally(() => {
            this.running.delete(jobId);
          });
        }

        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Exit if nothing left to do
        if (this.pendingQueue.length === 0 && this.running.size === 0) {
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single job
   * @param {Object} job
   */
  async executeJob(job) {
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date().toISOString();

    // Update in database
    if (this.db && this.db.updateJobStatus) {
      this.db.updateJobStatus(job.id, JobStatus.RUNNING, job.startedAt);
    }

    try {
      let result;

      switch (job.type) {
      case JobType.CHECK_BASE_TICKET:
        result = await this.executeCheckBaseTicket(job.data);
        break;
      case JobType.DOWNLOAD_TICKET_FOR_USER:
        result = await this.executeDownloadTicketForUser(job.data);
        break;
      case JobType.DOWNLOAD_TICKETS_FOR_ALL_USERS:
        result = await this.executeDownloadTicketsForAllUsers(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date().toISOString();

      // Update in database
      if (this.db && this.db.updateJobStatus) {
        this.db.updateJobStatus(job.id, JobStatus.COMPLETED, null, job.completedAt, JSON.stringify(result));
      }
    } catch (error) {
      job.error = error.message;

      // Retry logic
      if (job.retries < this.maxRetries) {
        job.retries++;
        job.status = JobStatus.RETRYING;

        console.log(`Job ${job.id} failed, retrying (${job.retries}/${this.maxRetries})...`);

        // Update in database
        if (this.db && this.db.updateJobStatus) {
          this.db.updateJobStatus(job.id, JobStatus.RETRYING, null, null, null, error.message);
        }

        // Re-enqueue with delay
        setTimeout(() => {
          job.status = JobStatus.PENDING;
          this.pendingQueue.push(job.id);
          this.processQueue();
        }, this.retryDelay);
      } else {
        job.status = JobStatus.FAILED;
        job.completedAt = new Date().toISOString();

        console.error(`Job ${job.id} failed after ${this.maxRetries} retries:`, error.message);

        // Update in database
        if (this.db && this.db.updateJobStatus) {
          this.db.updateJobStatus(job.id, JobStatus.FAILED, null, job.completedAt, null, error.message);
        }
      }
    }
  }

  /**
   * Execute checkBaseTicket job
   * Uses admin account to check base ticket and enqueue user jobs if changed
   */
  async executeCheckBaseTicket(data) {
    const { adminUserId } = data;

    if (!adminUserId) {
      throw new Error('adminUserId required for checkBaseTicket job');
    }

    if (!this.db) {
      throw new Error('Database required for checkBaseTicket job');
    }

    // Get admin user
    const adminUser = this.db.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      throw new Error('Admin user not found or invalid');
    }

    // Get admin UK credentials
    const adminCred = this.db.getUserCredential(adminUserId);
    if (!adminCred || !adminCred.uk_password_encrypted) {
      throw new Error('Admin UK credentials not configured');
    }

    // Download ticket for admin to get base ticket
    const downloadResult = await downloadTicketForUser(adminUser, {
      defaultDeviceProfile: this.defaultDeviceProfile,
      outputRoot: this.outputRoot,
      db: this.db,
      encryptionKey: this.encryptionKey
    });

    if (!downloadResult.success) {
      throw new Error(`Failed to download admin ticket: ${downloadResult.message}`);
    }

    // Calculate hash of the ticket content
    const ticketHash = downloadResult.contentHash || this.calculateContentHash(downloadResult.filePath);

    // Get current base ticket state
    const currentState = this.db.getBaseTicketState();
    const hasChanged = !currentState || currentState.base_ticket_hash !== ticketHash;

    // Update base ticket state
    this.db.setBaseTicketState({
      base_ticket_hash: ticketHash,
      effective_from: downloadResult.ticketVersion || new Date().toISOString(),
      last_checked_at: new Date().toISOString()
    });

    const result = {
      ticketHash,
      hasChanged,
      previousHash: currentState?.base_ticket_hash || null
    };

    // If ticket changed, enqueue download jobs for all auto-download-enabled users
    if (hasChanged) {
      const usersToUpdate = this.db
        .listActiveUsers()
        .filter((u) => u.auto_download_enabled && u.id !== adminUserId);

      result.usersEnqueued = usersToUpdate.length;
      result.enqueuedJobIds = [];

      for (const user of usersToUpdate) {
        const jobId = this.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, {
          userId: user.id,
          triggeredBy: 'baseTicketChange'
        });
        result.enqueuedJobIds.push(jobId);
      }

      console.log(`Base ticket changed. Enqueued ${usersToUpdate.length} user download jobs.`);
    } else {
      result.usersEnqueued = 0;
      console.log('Base ticket unchanged, no user jobs enqueued.');
    }

    return result;
  }

  /**
   * Execute downloadTicketForUser job
   */
  async executeDownloadTicketForUser(data) {
    const { userId } = data;

    if (!userId) {
      throw new Error('userId required for downloadTicketForUser job');
    }

    if (!this.db) {
      throw new Error('Database required for downloadTicketForUser job');
    }

    // Get user
    const user = this.db.getActiveUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found or not active`);
    }

    // Get user UK credentials
    const userCred = this.db.getUserCredential(userId);
    if (!userCred || !userCred.uk_password_encrypted) {
      throw new Error(`UK credentials not configured for user ${userId}`);
    }

    // Download ticket
    const downloadResult = await downloadTicketForUser(user, {
      defaultDeviceProfile: this.defaultDeviceProfile,
      outputRoot: this.outputRoot,
      db: this.db,
      encryptionKey: this.encryptionKey
    });

    // Update user's last login status
    if (downloadResult.success) {
      this.db.updateUserCredentialStatus(userId, 'success', null, new Date().toISOString());
    } else {
      this.db.updateUserCredentialStatus(userId, 'failed', downloadResult.message, new Date().toISOString());
    }

    return downloadResult;
  }

  /**
   * Execute downloadTicketsForAllUsers job
   */
  async executeDownloadTicketsForAllUsers(data) {
    if (!this.db) {
      throw new Error('Database required for downloadTicketsForAllUsers job');
    }

    // Get all active users with auto_download_enabled
    const users = this.db.listActiveUsers().filter((u) => u.auto_download_enabled);

    const results = {
      total: users.length,
      enqueuedJobIds: []
    };

    // Enqueue individual jobs for each user
    for (const user of users) {
      const jobId = this.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, {
        userId: user.id,
        triggeredBy: data.triggeredBy || 'manualAllUsers'
      });
      results.enqueuedJobIds.push(jobId);
    }

    return results;
  }

  /**
   * Calculate content hash for a file
   */
  calculateContentHash(filePath) {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = {
  JobQueue,
  JobStatus,
  JobType
};
