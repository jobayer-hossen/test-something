const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[35m',
  reset: '\x1b[0m',
};

class Logger {
  constructor(module) {
    this.module = module;
  }

  log(logLevel, message, data = '') {
    const timestamp = new Date().toLocaleTimeString();
    const color = COLORS[logLevel];
    const reset = COLORS.reset;

    console.log(
      `${color}[${timestamp}] [${logLevel.toUpperCase()}] [${this.module}]${reset} ${message}`,
      data
    );
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }
}

module.exports = Logger;