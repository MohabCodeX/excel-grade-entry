
/**
 * Logger utility for the application
 * In a real Electron app, this would write to files
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * Logs a message with the specified level
 * In a real implementation, this would write to a file
 */
export const log = (level: LogLevel, context: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level}] [${context}] ${message}`;
  
  if (data) {
    try {
      if (typeof data === 'object') {
        logMessage += '\nData: ' + JSON.stringify(data);
      } else {
        logMessage += '\nData: ' + String(data);
      }
    } catch (e) {
      logMessage += '\nData: [Cannot stringify data]';
    }
  }

  // In a browser environment, just log to console
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(logMessage);
      break;
    case LogLevel.INFO:
      console.info(logMessage);
      break;
    case LogLevel.WARNING:
      console.warn(logMessage);
      break;
    case LogLevel.ERROR:
      console.error(logMessage);
      break;
  }

  // In a real Electron app, we would use fs to write to logs/log.txt
  // Example:
  // const fs = require('fs');
  // const path = require('path');
  // const logDir = path.join(app.getPath('userData'), 'logs');
  // if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  // fs.appendFileSync(path.join(logDir, 'log.txt'), logMessage + '\n');
};

/**
 * Debug level log
 */
export const debug = (context: string, message: string, data?: any) => {
  log(LogLevel.DEBUG, context, message, data);
};

/**
 * Info level log
 */
export const info = (context: string, message: string, data?: any) => {
  log(LogLevel.INFO, context, message, data);
};

/**
 * Warning level log
 */
export const warn = (context: string, message: string, data?: any) => {
  log(LogLevel.WARNING, context, message, data);
};

/**
 * Error level log
 */
export const error = (context: string, message: string, data?: any) => {
  log(LogLevel.ERROR, context, message, data);
};

/**
 * Logs user feedback
 */
export const logFeedback = (feedback: string, email?: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [FEEDBACK] ${feedback}${email ? ' (from: ' + email + ')' : ''}`;
  
  console.log(logEntry);
  // In a real app, we would use fs to write to logs/feedback.txt
};
