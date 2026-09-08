import { FastifyInstance } from 'fastify';
import { db } from '../db';

export default async function boardRoutes(fastify: FastifyInstance) {
  
  // POST /api/board - Add board lines (authenticated by X-Host-Key)
  fastify.post('/board', {
    schema: {
      body: {
        type: 'object',
        required: ['host', 'lines'],
        properties: {
          host: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              required: ['ts', 'role', 'kind', 'text'],
              properties: {
                ts: { type: 'integer' },
                role: { type: 'string' },
                kind: { type: 'string' },
                text: { type: 'string' },
                mode: { type: 'string' },
                reason: { type: 'string' }
              }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verify host key
      const hostKey = request.headers['x-host-key'] as string;
      
      // In a real implementation, we'd verify the host key against stored secrets
      // For now, we'll check if it's present (simplified validation)
      if (!hostKey || hostKey.length < 10) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid host key' });
      }
      
      const { host, lines } = request.body as {
        host: string;
        lines: Array<{
          ts: number;
          role: string;
          kind: string;
          text: string;
          mode?: string;
          reason?: string;
        }>;
      };
      
      // Validate host
      if (!host || host.length === 0) {
        return reply.status(400).send({ error: 'Invalid host' });
      }
      
      // Insert each line into the database
      const insertStmt = db.prepare(`
        INSERT INTO board_lines (host, ts, role, kind, text, mode, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const line of lines) {
        insertStmt.run(
          host,
          line.ts,
          line.role,
          line.kind,
          line.text,
          line.mode || null,
          line.reason || null
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error adding board lines:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });
}