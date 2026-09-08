import { FastifyInstance } from 'fastify';
import { db } from '../db';

export default async function nodesRoutes(fastify: FastifyInstance) {
  
  // GET /api/nodes - Get all nodes with joined data
  fastify.get('/nodes', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              node_id: { type: 'string' },
              label: { type: 'string' },
              layer: { type: 'string' },
              track: { type: 'string' },
              fork: { type: 'string' },
              tag: { type: 'string' },
              ef_tier: { type: 'string' },
              criterion_type: { type: 'string' },
              criterion: { type: 'string' },
              routing_mode: { type: 'string' },
              state: { type: 'string' },
              bounty: { type: 'string' },
              criterion_hash: { type: 'string' },
              ens_name: { type: 'string' },
              opened_block: { type: 'integer' },
              head: { type: 'string' },
              active_lease_count: { type: 'integer' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const nodes = db.prepare(`
        SELECT n.*, h.head, COUNT(l.node_id) as active_lease_count
        FROM nodes n
        LEFT JOIN heads h ON n.node_id = h.node_id
        LEFT JOIN leases l ON n.node_id = l.node_id AND l.active = 1
        GROUP BY n.node_id
        ORDER BY n.node_id
      `).all();
      
      return nodes;
    } catch (error) {
      console.error('Error fetching nodes:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/nodes/:id - Get specific node with all related data
  // No response schema on this route. fast-json-stringify strips every property a schema does not
  // declare, and the previous one declared `node: {type:'object'}` with no properties — so the API
  // answered {"node":{},"leases":[],...} for a node that was fully populated in the database. A
  // schema that silently empties the payload is worse than no schema.
  fastify.get('/nodes/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      // Get node data
      const node = db.prepare('SELECT * FROM nodes WHERE node_id = ?').get(id);
      if (!node) {
        return reply.status(404).send({ error: 'Node not found' });
      }
      
      // Get related data
      const leases = db.prepare('SELECT * FROM leases WHERE node_id = ?').all(id);
      const leaseEvents = db.prepare('SELECT * FROM lease_events WHERE node_id = ?').all(id);
      const submissions = db.prepare('SELECT * FROM submissions WHERE node_id = ?').all(id);
      const verdicts = db.prepare('SELECT * FROM verdicts WHERE node_id = ?').all(id);
      const attribution = db.prepare('SELECT * FROM attribution WHERE node_id = ?').all(id);
      const releases = db.prepare('SELECT * FROM releases WHERE node_id = ?').all(id);
      
      // Get head data
      const head = db.prepare('SELECT * FROM heads WHERE node_id = ?').get(id);
      
      // Get freshness info (placeholder)
      const freshness = {
        lastBlock: 0,
        lastTs: 0
      };
      
      return {
        node,
        leases,
        lease_events: leaseEvents,
        submissions,
        verdicts,
        attribution,
        releases,
        head,
        freshness
      };
    } catch (error) {
      console.error('Error fetching node:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/nodes/:id/leases - Get leases for a specific node
  fastify.get('/nodes/:id/leases', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const leases = db.prepare('SELECT * FROM leases WHERE node_id = ?').all(id);
      return leases;
    } catch (error) {
      console.error('Error fetching leases:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/nodes/:id/attribution - Get attribution for a specific node
  fastify.get('/nodes/:id/attribution', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const attribution = db.prepare('SELECT * FROM attribution WHERE node_id = ?').all(id);
      return attribution;
    } catch (error) {
      console.error('Error fetching attribution:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/nodes/:id/submissions - Get submissions for a specific node
  fastify.get('/nodes/:id/submissions', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const submissions = db.prepare('SELECT * FROM submissions WHERE node_id = ?').all(id);
      return submissions;
    } catch (error) {
      console.error('Error fetching submissions:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });
}