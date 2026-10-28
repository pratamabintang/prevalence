import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { initDb, closeDb } from './db/connection';
import { migrateSchema } from './db/schema';
import { seedDistricts } from './db/seeds';

// Load .env file if present
function loadEnv(): void {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (key && !(key in process.env)) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // Ignore read error
      }
      break;
    }
  }
}
loadEnv();

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
