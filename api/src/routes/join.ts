import { FastifyInstance } from 'fastify';
import { PrivyClient } from '@privy-io/server-auth';
import { db } from '../db';

/**
 * The guest flow (PRD 3.25). A judge logs in with Privy, gets a name under ethplane.eth, and can
 * act. Three rules this route keeps:
 *
 *  - the token is verified, never trusted. Without PRIVY_APP_ID and PRIVY_APP_SECRET the route
 *    refuses every request rather than falling back to an unverified identity — an auth endpoint
 *    that degrades to "believe the caller" when misconfigured is worse than one that is down.
 *  - it is idempotent: a returning user gets the same guest name, because the name is their
 *    identity and a second login must not mint a second one.
 *  - it signs nothing. The ENS registration is a row in pending_names that the maintainer key
 *    registers separately, so no key lives in the request path.
 */
const IDENTITY_RESOLVER = process.env.IDENTITY_RESOLVER ?? '0x47572265f1795F26A3e657DA154577904aAA57Ed';
const GUEST_TTL_SECONDS = Number(process.env.GUEST_TTL ?? 14 * 24 * 60 * 60);

let privy: PrivyClient | null = null;
function client(): PrivyClient | null {
  const id = process.env.PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!id || !secret) return null;
  if (!privy) privy = new PrivyClient(id, secret);
  return privy;
}

function nextGuestName(): string {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM guests`).get() as { n: number };
  return `judge-${row.n + 1}`;
}

export default async function joinRoutes(fastify: FastifyInstance) {
  fastify.post('/join', async (request, reply) => {
    const p = client();
    if (!p) {
      return reply.status(503).send({ error: 'join is not configured: PRIVY_APP_ID and PRIVY_APP_SECRET are unset' });
    }
    const auth = request.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const body = (request.body ?? {}) as { wallet?: string };
    if (!token) return reply.status(401).send({ error: 'missing bearer token' });

    let userId: string;
    try {
      const claims = await p.verifyAuthToken(token);
      userId = claims.userId;
    } catch (err) {
      request.log.warn({ err: String(err) }, 'join: token rejected');
      return reply.status(401).send({ error: 'token rejected' });
    }

    // The wallet comes from Privy's own record of the user, not from the request body, unless the
    // user object has none yet (a fresh embedded wallet can lag the token by a moment).
    let wallet = '';
    try {
      const user = await p.getUser(userId);
      const embedded = user.linkedAccounts.find(
        (a) => a.type === 'wallet' && (a as { walletClientType?: string }).walletClientType === 'privy'
      ) as { address?: string } | undefined;
      const anyWallet = user.linkedAccounts.find((a) => a.type === 'wallet') as { address?: string } | undefined;
      wallet = embedded?.address ?? anyWallet?.address ?? '';
    } catch (err) {
      request.log.warn({ err: String(err) }, 'join: could not read the user');
    }
    if (!wallet && body.wallet) wallet = body.wallet;
    if (!wallet) return reply.status(409).send({ error: 'no wallet on this account yet' });

    const existing = db.prepare(`SELECT guest_name, wallet FROM guests WHERE privy_user_id = ?`).get(userId) as
      | { guest_name: string; wallet: string }
      | undefined;
    if (existing) {
      if (existing.wallet !== wallet) {
        db.prepare(`UPDATE guests SET wallet = ? WHERE privy_user_id = ?`).run(wallet, userId);
      }
      return { guestName: existing.guest_name, wallet, returning: true };
    }

    const guestName = nextGuestName();
    const now = Math.floor(Date.now() / 1000);
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO guests(privy_user_id, wallet, guest_name, created_at) VALUES(?,?,?,?)`)
        .run(userId, wallet, guestName, now);
      db.prepare(
        `INSERT INTO pending_names(label, owner, resolver, expiry, registered, created_at) VALUES(?,?,?,?,0,?)
         ON CONFLICT(label) DO NOTHING`
      ).run(guestName, wallet, IDENTITY_RESOLVER, now + GUEST_TTL_SECONDS, now);
    });
    tx();
    return { guestName, wallet, returning: false };
  });

  fastify.get('/guests/:wallet', async (request, reply) => {
    const { wallet } = request.params as { wallet: string };
    const row = db
      .prepare(`SELECT g.guest_name, p.registered FROM guests g LEFT JOIN pending_names p ON p.label = g.guest_name
                WHERE lower(g.wallet) = lower(?)`)
      .get(wallet) as { guest_name?: string; registered?: number } | undefined;
    if (!row?.guest_name) return reply.status(404).send({ error: 'no guest for that wallet' });
    return { guestName: row.guest_name, registered: Boolean(row.registered) };
  });
}
