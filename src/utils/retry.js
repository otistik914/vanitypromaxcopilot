import fs from 'node:fs';
import path from 'node:path';

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function withRetry({
  fn,
  retries,
  delayMs,
  shouldRetry = () => true,
  onRetry
}) {
  let attempts = 0;

  const run = async () => {
    try {
      return await fn();
    } catch (error) {
      attempts += 1;
      if (attempts > retries || !shouldRetry(error, attempts)) {
        throw error;
      }

      if (onRetry) {
        onRetry({ attempt: attempts, error });
      }

      await wait(delayMs);
      return run();
    }
  };

  return run();
}
