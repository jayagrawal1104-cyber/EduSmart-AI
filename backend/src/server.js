import 'dotenv/config';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

start();