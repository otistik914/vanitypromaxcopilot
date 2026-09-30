import { startApp } from './app.js';

(async () => {
  try {
    const app = await startApp();
  } catch (error) {
    console.error('❌ Failed to start application:');
    console.error(error.message);
    process.exit(1);
  }
})();
