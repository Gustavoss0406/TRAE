/**
 * Sync Logger
 * 
 * Structured logging for ingestion workers
 */

export interface SyncLog {
  workerId: string;
  timestamp: Date;
  source: "football-data.org" | "cache" | "d1" | "static-list";
  recordsProcessed: number;
  recordsUpdated: number;
  recordsInserted: number;
  errors: string[];
  duration: number;
  metadata?: Record<string, any>;
}

export class SyncLogger {
  private logs: SyncLog[] = [];

  startSync(workerId: string): SyncContext {
    const startTime = Date.now();
    const context: SyncContext = {
      workerId,
      startTime,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsInserted: 0,
      errors: [],
      metadata: {},
    };

    return context;
  }

  endSync(context: SyncContext, source: SyncLog["source"]): SyncLog {
    const duration = Date.now() - context.startTime;
    
    const log: SyncLog = {
      workerId: context.workerId,
      timestamp: new Date(),
      source,
      recordsProcessed: context.recordsProcessed,
      recordsUpdated: context.recordsUpdated,
      recordsInserted: context.recordsInserted,
      errors: context.errors,
      duration,
      metadata: context.metadata,
    };

    this.logs.push(log);
    
    // Log to console
    console.log(`[${log.workerId}] Sync completed:`, {
      source: log.source,
      processed: log.recordsProcessed,
      updated: log.recordsUpdated,
      inserted: log.recordsInserted,
      errors: log.errors.length,
      duration: `${log.duration}ms`,
    });

    if (log.errors.length > 0) {
      console.error(`[${log.workerId}] Errors:`, log.errors);
    }

    return log;
  }

  getLogs(): SyncLog[] {
    return this.logs;
  }

  getLastLog(workerId: string): SyncLog | undefined {
    return this.logs
      .filter(log => log.workerId === workerId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export interface SyncContext {
  workerId: string;
  startTime: number;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsInserted: number;
  errors: string[];
  metadata: Record<string, any>;
}

// Export singleton instance
export const syncLogger = new SyncLogger();
