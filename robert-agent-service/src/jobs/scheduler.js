/**
 * Job Scheduler
 * Central scheduler for all cron jobs using node-cron
 */

import cron from 'node-cron';

class JobScheduler {
  constructor() {
    this.jobs = new Map(); // Map of job name -> cron job instance
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.warn('⚠️ [SCHEDULER] Scheduler is already running');
      return;
    }

    console.log('🕐 [SCHEDULER] Starting job scheduler...');
    this.isRunning = true;

    // Jobs will be registered by individual job modules
    // This method is called after all jobs are registered
    console.log(`✅ [SCHEDULER] Scheduler started with ${this.jobs.size} jobs`);
  }

  /**
   * Register a cron job
   * @param {string} name - Name of the job
   * @param {string} schedule - Cron schedule expression
   * @param {Function} jobFunction - Function to execute
   * @param {Object} options - Optional job options
   */
  registerJob(name, schedule, jobFunction, options = {}) {
    if (this.jobs.has(name)) {
      console.warn(`⚠️ [SCHEDULER] Job ${name} already registered, replacing...`);
      this.unregisterJob(name);
    }

    const cronJob = cron.schedule(
      schedule,
      async () => {
        const startTime = Date.now();
        console.log(`⏰ [SCHEDULER] Starting job: ${name}`);
        
        try {
          await jobFunction();
          const duration = Date.now() - startTime;
          console.log(`✅ [SCHEDULER] Job ${name} completed in ${duration}ms`);
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ [SCHEDULER] Job ${name} failed after ${duration}ms:`, error);
          
          // Call error handler if provided
          if (options.onError) {
            try {
              await options.onError(error);
            } catch (errorHandlerError) {
              console.error(`❌ [SCHEDULER] Error handler for ${name} failed:`, errorHandlerError);
            }
          }
        }
      },
      {
        scheduled: false, // Don't start immediately
        timezone: options.timezone || 'Europe/London'
      }
    );

    this.jobs.set(name, {
      cronJob,
      schedule,
      name,
      options
    });

    // Start the job if scheduler is running
    if (this.isRunning) {
      cronJob.start();
      console.log(`📅 [SCHEDULER] Registered job: ${name} (schedule: ${schedule})`);
    }
  }

  /**
   * Unregister a job
   * @param {string} name - Name of the job
   */
  unregisterJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.cronJob.stop();
      job.cronJob.destroy();
      this.jobs.delete(name);
      console.log(`🗑️ [SCHEDULER] Unregistered job: ${name}`);
    }
  }

  /**
   * Get all registered jobs
   * @returns {Array} Array of job information
   */
  getJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      schedule: job.schedule,
      isRunning: job.cronJob.running || false
    }));
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 [SCHEDULER] Stopping scheduler...');
    this.jobs.forEach((job, name) => {
      job.cronJob.stop();
      console.log(`⏸️ [SCHEDULER] Stopped job: ${name}`);
    });
    
    this.isRunning = false;
    console.log('✅ [SCHEDULER] Scheduler stopped');
  }

  /**
   * Stop all jobs and destroy scheduler
   */
  destroy() {
    this.stop();
    this.jobs.forEach((job) => {
      job.cronJob.destroy();
    });
    this.jobs.clear();
    console.log('🗑️ [SCHEDULER] Scheduler destroyed');
  }
}

// Export singleton instance
const scheduler = new JobScheduler();

export default scheduler;

