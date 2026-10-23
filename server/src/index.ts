import { createApp } from './app';
import { initDb, closeDb } from './db/connection';
import { migrateSchema } from './db/schema';
import { seedDistricts } from './db/seeds';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer(): Promise<void> {
  try {
    // 1. Inisialisasi Database SQLite
    const db = initDb();
    console.log('[Dinkes Server] SQLite database initialized at:', process.env.DB_PATH || 'data/dinkes.db');

    // 2. Migrasi Skema
    migrateSchema(db);
    console.log('[Dinkes Server] Database schema migrated successfully.');

    // 3. Seeding Data Wilayah 35 Kab/Kota & Target Indikator
    seedDistricts(db);
    console.log('[Dinkes Server] Master districts seeded (35 Kab/Kota).');

    // 4. Start Express Server
    const app = createApp();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Dinkes Server] API Server running on http://0.0.0.0:${PORT}`);
      console.log(`[Dinkes Server] Health check available at: http://0.0.0.0:${PORT}/api/health`);
    });

    const shutdown = (signal: string) => {
      console.log(`[Dinkes Server] Received ${signal}. Closing HTTP server and SQLite WAL connection...`);
      server.close(() => {
        closeDb();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('[Dinkes Server] Fatal error during startup:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
