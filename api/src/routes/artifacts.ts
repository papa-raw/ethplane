import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Artifacts are addressed by the sha256 of their bytes, which is the same hash the contract records
 * as a submission. Two consequences the routes enforce rather than assume:
 *
 *  - an upload is stored under the hash of what actually arrived, and rejected if the caller's
 *    claimed hash disagrees. A store where the name and the bytes can differ is not content-
 *    addressed, it is just a filename.
 *  - a download is served from the file named by the requested hash, so the CLI's own check
 *    (bytes must hash to the name asked for) is verifying the same property end to end.
 */
const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? path.join(process.cwd(), 'data', 'artifacts');
const MAX_BYTES = Number(process.env.ARTIFACT_MAX_BYTES ?? 64 * 1024 * 1024);

function hashOf(buf: Buffer): string {
  return '0x' + createHash('sha256').update(buf).digest('hex');
}

function pathFor(hash: string): string {
  return path.join(ARTIFACT_DIR, `${hash.toLowerCase()}.tar.gz`);
}

export default async function artifactRoutes(fastify: FastifyInstance) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  // The body is a tarball, so it is read as bytes rather than parsed.
  fastify.addContentTypeParser(
    ['application/gzip', 'application/x-gzip', 'application/octet-stream', 'application/x-tar'],
    { parseAs: 'buffer', bodyLimit: MAX_BYTES },
    (_req, body, done) => done(null, body)
  );

  fastify.get('/artifacts/:hash', async (request, reply) => {
    const { hash } = request.params as { hash: string };
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return reply.status(400).send({ error: 'hash must be 0x + 64 hex' });
    const file = pathFor(hash);
    if (!fs.existsSync(file)) return reply.status(404).send({ error: 'no artifact with that hash' });
    reply.header('content-type', 'application/gzip');
    reply.header('content-disposition', `attachment; filename="${hash}.tar.gz"`);
    return fs.createReadStream(file);
  });

  fastify.post('/artifacts', async (request, reply) => {
    const body = request.body as Buffer | undefined;
    if (!body || !Buffer.isBuffer(body) || body.length === 0) {
      return reply.status(400).send({ error: 'empty body: send the tarball as the request body' });
    }
    const hash = hashOf(body);
    const claimed = (request.headers['x-artifact-hash'] as string | undefined)?.toLowerCase();
    if (claimed && claimed !== hash) {
      return reply.status(409).send({ error: 'hash mismatch', claimed, actual: hash });
    }
    const file = pathFor(hash);
    if (!fs.existsSync(file)) fs.writeFileSync(file, body);
    return reply.status(201).send({ hash, bytes: body.length, stored: true });
  });
}
