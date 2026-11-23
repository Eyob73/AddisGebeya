export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.info(`[${timestamp}] [INFO] ${message}`, meta);
      return;
    }
    console.info(`[${timestamp}] [INFO] ${message}`);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${message}`, meta);
      return;
    }
    console.warn(`[${timestamp}] [WARN] ${message}`);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.error(`[${timestamp}] [ERROR] ${message}`, meta);
      return;
    }
    console.error(`[${timestamp}] [ERROR] ${message}`);
  },
};
