import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const DEFAULT_API = process.env.API_BASE || 'https://ethplane.ecofrontiers.xyz';

export function sha256(buf: Buffer): string {
  return '0x' + createHash('sha256').update(buf).digest('hex');
}

/**
 * Download an artifact and refuse it unless its bytes hash to the name it was fetched under. The
 * hash is the artifact's identity: an artifact that does not match its hash is not a late version,
 * it is a different file, and unpacking it would put someone else's code in your directory.
 */
export async function fetchArtifact(
  head: string,
  apiBase = DEFAULT_API,
  fetchImpl: typeof fetch = fetch
): Promise<Buffer> {
  const res = await fetchImpl(`${apiBase}/api/artifacts/${head}`);
  if (!res.ok) throw new Error(`artifact ${head} responded ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got.toLowerCase() !== head.toLowerCase()) {
    throw new Error(`hash mismatch: asked for ${head}, received bytes hashing to ${got}`);
  }
  return buf;
}

/** Unpack into ./<label>/ with tar's own data filter; returns the manifest if the artifact has one. */
export function unpack(buf: Buffer, dir: string): { contributors?: string[]; [k: string]: unknown } | null {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, '.artifact.tar.gz');
  fs.writeFileSync(tmp, buf);
  const res = spawnSync('tar', ['xzf', tmp, '-C', dir], { encoding: 'utf-8' });
  fs.unlinkSync(tmp);
  if (res.status !== 0) throw new Error(`could not unpack: ${res.stderr?.trim() || 'tar failed'}`);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}
