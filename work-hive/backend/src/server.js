import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { ensureBootstrapAdmin } from './utils/bootstrapAdmin.js';

const startServer = async () => {
  try {
    await connectDB();
    await ensureBootstrapAdmin();
    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
