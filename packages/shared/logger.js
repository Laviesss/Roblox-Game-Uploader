export const logger = {
  info: (message, meta = {}) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, meta),
  error: (message, error = {}, meta = {}) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, { message: error.message, stack: error.stack, ...meta }),
  warn: (message, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, meta)
};
