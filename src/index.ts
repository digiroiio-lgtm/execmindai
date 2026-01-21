import { bootstrapSystem } from './app';

bootstrapSystem()
  .catch((err) => {
    console.error('Fatal error while bootstrapping ExecMindAI runtime:', err);
    process.exit(1);
  });
