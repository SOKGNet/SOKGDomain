/**
 * Simple logger module for PR validation
 */
class Logger {
  constructor() {
    this.logs = [];
  }

  info(message) {
    console.log(`[INFO] ${message}`);
    this.logs.push({ level: 'info', message });
  }

  warn(message) {
    console.warn(`[WARN] ${message}`);
    this.logs.push({ level: 'warn', message });
  }

  error(message) {
    console.error(`[ERROR] ${message}`);
    this.logs.push({ level: 'error', message });
  }

  debug(message) {
    console.debug(`[DEBUG] ${message}`);
    this.logs.push({ level: 'debug', message });
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}

module.exports = new Logger(); 