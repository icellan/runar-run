import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDb } from './db/migrations.js';
import { shareRoutes } from './routes/share.js';
import { healthRoutes } from './routes/health.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

async function start() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Initialize database
  const db = initDb();

  // Register routes
  app.register(healthRoutes);
  app.register(shareRoutes, { prefix: '/api', db });

  await app.listen({ port: PORT, host: HOST });
  console.log(`Backend listening on ${HOST}:${PORT}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
