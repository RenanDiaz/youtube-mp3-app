const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Progress Tracker for managing download progress
 * Stores active downloads and their progress in memory
 */
class ProgressTracker {
  constructor() {
    // Map of downloadId -> { progress, speed, eta, status, clients }
    this.downloads = new Map();

    // Cleanup old downloads after 1 hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Create a new download and return its ID
   */
  createDownload() {
    const downloadId = uuidv4();

    this.downloads.set(downloadId, {
      id: downloadId,
      progress: 0,
      speed: '0 B/s',
      eta: 'calculating...',
      status: 'initializing',
      startTime: Date.now(),
      clients: new Set(), // SSE clients listening to this download
      metadata: {}
    });

    logger.info(`Created download: ${downloadId}`);
    return downloadId;
  }

  /**
   * Update progress for a download
   */
  updateProgress(downloadId, data) {
    const download = this.downloads.get(downloadId);
    if (!download) {
      logger.warn(`Attempted to update non-existent download: ${downloadId}`);
      return;
    }

    // Update download data
    Object.assign(download, data);

    // Notify all connected SSE clients
    this.notifyClients(downloadId, {
      type: 'progress',
      downloadId,
      ...data
    });
  }

  /**
   * Update download status
   */
  updateStatus(downloadId, status, message = '') {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.status = status;
    download.statusMessage = message;

    this.notifyClients(downloadId, {
      type: 'status',
      downloadId,
      status,
      message
    });

    logger.info(`Download ${downloadId} status: ${status}`);
  }

  /**
   * Mark download as complete
   */
  completeDownload(downloadId, result) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.status = 'completed';
    download.progress = 100;
    download.result = result;
    download.completedAt = Date.now();

    this.notifyClients(downloadId, {
      type: 'complete',
      downloadId,
      result
    });

    logger.info(`Download ${downloadId} completed`);

    // Close all SSE connections after notifying
    setTimeout(() => this.closeClients(downloadId), 1000);
  }

  /**
   * Mark download as failed
   */
  failDownload(downloadId, error) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.status = 'failed';
    download.error = error;
    download.failedAt = Date.now();

    this.notifyClients(downloadId, {
      type: 'error',
      downloadId,
      error: error.message || 'Download failed'
    });

    logger.error(`Download ${downloadId} failed:`, error);

    // Close all SSE connections after notifying
    setTimeout(() => this.closeClients(downloadId), 1000);
  }

  /**
   * Add SSE client for a download
   */
  addClient(downloadId, res) {
    const download = this.downloads.get(downloadId);
    if (!download) {
      logger.warn(`Attempted to add client to non-existent download: ${downloadId}`);
      return false;
    }

    download.clients.add(res);
    logger.info(`Client connected to download: ${downloadId}`);

    // Send current state immediately
    this.sendEvent(res, {
      type: 'connected',
      downloadId,
      progress: download.progress,
      status: download.status
    });

    return true;
  }

  /**
   * Remove SSE client
   */
  removeClient(downloadId, res) {
    const download = this.downloads.get(downloadId);
    if (download) {
      download.clients.delete(res);
      logger.info(`Client disconnected from download: ${downloadId}`);
    }
  }

  /**
   * Send event to a single SSE client
   */
  sendEvent(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      logger.error('Error sending SSE event:', err);
    }
  }

  /**
   * Notify all clients listening to a download
   */
  notifyClients(downloadId, data) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.clients.forEach(client => {
      this.sendEvent(client, data);
    });
  }

  /**
   * Close all SSE connections for a download
   */
  closeClients(downloadId) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.clients.forEach(client => {
      try {
        client.end();
      } catch (err) {
        logger.error('Error closing SSE client:', err);
      }
    });

    download.clients.clear();
  }

  /**
   * Get download info
   */
  getDownload(downloadId) {
    return this.downloads.get(downloadId);
  }

  /**
   * Check if download exists
   */
  hasDownload(downloadId) {
    return this.downloads.has(downloadId);
  }

  /**
   * Cleanup completed/failed downloads older than 1 hour
   */
  cleanup() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [id, download] of this.downloads.entries()) {
      const isOld =
        (download.completedAt && now - download.completedAt > oneHour) ||
        (download.failedAt && now - download.failedAt > oneHour);

      if (isOld) {
        this.closeClients(id);
        this.downloads.delete(id);
        logger.info(`Cleaned up old download: ${id}`);
      }
    }
  }

  /**
   * Get stats for all downloads
   */
  getStats() {
    const stats = {
      total: this.downloads.size,
      active: 0,
      completed: 0,
      failed: 0
    };

    for (const download of this.downloads.values()) {
      if (download.status === 'completed') stats.completed++;
      else if (download.status === 'failed') stats.failed++;
      else stats.active++;
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new ProgressTracker();
