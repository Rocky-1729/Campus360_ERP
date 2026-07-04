/** Log level type */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** ANSI color codes for terminal output */
const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  debug: '\x1b[35m',   // Magenta
};

const RESET = '\x1b[0m';

/**
 * Format the current timestamp for log output.
 */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Simple console logger with timestamps and color-coded log levels.
 */
export const logger = {
  /** Log an informational message */
  info(message: string, ...args: unknown[]): void {
    console.log(`${COLORS.info}[${getTimestamp()}] [INFO]${RESET} ${message}`, ...args);
  },

  /** Log a warning message */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`${COLORS.warn}[${getTimestamp()}] [WARN]${RESET} ${message}`, ...args);
  },

  /** Log an error message */
  error(message: string, ...args: unknown[]): void {
    console.error(`${COLORS.error}[${getTimestamp()}] [ERROR]${RESET} ${message}`, ...args);
  },

  /** Log a debug message */
  debug(message: string, ...args: unknown[]): void {
    console.debug(`${COLORS.debug}[${getTimestamp()}] [DEBUG]${RESET} ${message}`, ...args);
  },
};
