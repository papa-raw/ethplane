import fastify from 'fastify';
import { db, initializeDatabase, seedStrawmapMetadata } from './db';
import nodesRoutes from './routes/nodes';
import boardRoutes from './routes/board';
import joinRoutes from './routes/join';
import artifactRoutes from './routes/artifacts';
import { runIndexer } from './indexer';

// Initialize database. The migration collapses event rows the poller wrote twice before
// (tx, log_index) was unique; a redeploy that removes nothing says so by staying quiet.
const deduped = initializeDatabase();
const dedupedTotal = Object.values(deduped).reduce((a, b) => a + b, 0);
if (dedupedTotal > 0) console.warn(`removed ${dedupedTotal} duplicate event row(s):`, deduped);
const seeded = seedStrawmapMetadata();
if (seeded === 0) console.warn('strawmap metadata not found: nodes will have no labels (set STRAWMAP_JSON)');

// Create Fastify instance
const server = fastify({
  logger: true
});

// Register routes
server.register(nodesRoutes, { prefix: '/api' });
server.register(boardRoutes, { prefix: '/api' });
server.register(joinRoutes, { prefix: '/api' });
server.register(artifactRoutes, { prefix: '/api' });

// Health check endpoint
server.get('/health', async () => {
  return { status: 'OK' };
});

const PORT = Number(process.env.PORT ?? 4100);
const POLL_MS = Number(process.env.POLL_MS ?? 8000);

/** One pass, logged with a row count: "indexing" without a number is not evidence. */
async function poll(): Promise<void> {
  try {
    const rows = await runIndexer();
    const nodes = (db.prepare('SELECT COUNT(*) AS n FROM nodes').get() as { n: number }).n;
    server.log.info({ rows, nodes }, 'indexer pass complete');
    if (process.env.INDEX_ONCE === '1') {
      console.log(JSON.stringify({ rowsWritten: rows, nodes }));
      process.exit(0);
    }
  } catch (err) {
    server.log.error({ err: String(err) }, 'indexer pass failed');
    if (process.env.INDEX_ONCE === '1') process.exit(1);
  }
}

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    await poll();
    setInterval(poll, POLL_MS);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start();