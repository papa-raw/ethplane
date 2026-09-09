'use client';
import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { API_BASE } from '@/lib/api';
import '@/components/site/site.css';

export type JoinResult = { guestName: string; wallet: string; returning?: boolean };

/**
 * Login, then one call to POST /api/join, which verifies the Privy token server-side and hands back
 * a name under guests.ethplane.eth. The page never signs anything and never sees a key: the ENS
 * registration is a job the maintainer runs from the pending_names table.
 */
export function Join() {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const [result, setResult] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * One POST, and every way it can fail says so on the page. The button did nothing on the live site
   * with no console error and no request: a click that reaches a handler which throws before `fetch`
   * looks identical to a click that never landed, so the token step is now its own failure with its
   * own message, and the handler cannot exit without either a result or an error line.
   */
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Privy returned no access token. Sign out and sign in again.');
      const res = await fetch(`${API_BASE}/api/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ wallet: wallets[0]?.address ?? user?.wallet?.address ?? '' }),
      });
      const text = await res.text();
      let body: Record<string, unknown> = {};
      try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`join responded ${res.status} with ${text.slice(0, 80)}`); }
      if (!res.ok) throw new Error(String(body.error ?? `join responded ${res.status}`));
      setResult(body as unknown as JoinResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div data-testid="join-loading" className="ep-panel">
        <p>Loading.</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div data-testid="join-signed-out" className="ep-panel">
        <h2>Join the plane</h2>
        <p>
          Sign in with an email or a wallet. You get a name under guests.ethplane.eth and an embedded
          wallet if you do not have one, and you can start a session on any open worknode, exactly like
          any other contributor.
        </p>
        <button className="ep-btn ep-btn-primary" onClick={() => login()}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div data-testid="join-signed-in" className="ep-panel">
      <h2>You are in</h2>
      <p className="ep-addr">
        {wallets[0]?.address ?? user?.wallet?.address ?? 'no wallet yet'}
      </p>
      {result ? (
        <div data-testid="join-result">
          <p className="ep-name">{result.guestName}.guests.ethplane.eth</p>
          <p>
            {result.returning
              ? 'This name was already reserved for this wallet.'
              : 'Your name is reserved.'}{' '}
            The maintainer registers it on chain shortly, and the dashboard shows it as soon as it
            is.
          </p>

          <div data-testid="join-next" className="ep-next">
            <h3>Next steps</h3>
            <ol>
              <li>
                Your name is <span className="ep-mono">{result.guestName}.guests.ethplane.eth</span>{' '}
                and your wallet is{' '}
                <span className="ep-mono">{wallets[0]?.address ?? user?.wallet?.address ?? 'not created yet'}</span>.
                The name is a label you write on your lineage when you register it, as{' '}
                <span className="ep-mono">LINEAGE_NAME</span>. What the contract records is the key
                that signs, and this version does not check that the key owns the name.
              </li>
              <li>
                Install the CLI.
                <pre className="ep-code">{`git clone https://github.com/papa-raw/ethplane && cd ethplane
cd cli && pnpm install && pnpm build && npm link`}</pre>
              </li>
              <li>
                Read a worknode and take its head. The argument is the worknode&apos;s name, not
                yours. It prints the node id you need in step 4.
                <pre className="ep-code">ethplane join cl-pq-leanxmss-attestations.ethplane.eth</pre>
              </li>
              <li>
                Start a session. This one sends transactions, so it needs Foundry
                (<span className="ep-mono">curl -L https://foundry.paradigm.xyz | bash && foundryup</span>), a key on disk that you control, and a
                little Sepolia ETH. The Privy wallet holds your name; the client signs with the
                local key. <a href="/docs#join">The docs</a> carry the environment block and
                the four commands.
              </li>
            </ol>
            <p>
              The worknodes are on <a href="/">the map</a>. Add{' '}
              <span className="ep-mono">--dry-run</span> to any client command to see the transaction
              without sending it.
            </p>
          </div>
        </div>
      ) : (
        <p>
          <button className="ep-btn ep-btn-primary" onClick={() => { void join(); }} disabled={busy}>
            {busy ? 'Taking…' : 'Take my name'}
          </button>
        </p>
      )}
      {error ? (
        <p data-testid="join-error" className="ep-error">
          {error}
        </p>
      ) : null}
      <button onClick={logout} className="ep-link">
        sign out
      </button>
    </div>
  );
}
