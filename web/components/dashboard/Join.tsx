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

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ wallet: wallets[0]?.address ?? '' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `join responded ${res.status}`);
      setResult(body as JoinResult);
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
          wallet if you do not have one, and you can start a session on any open node, exactly like
          any other contributor.
        </p>
        <button className="ep-btn ep-btn-primary" onClick={login}>
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
            It is registered on chain by the maintainer shortly; the dashboard shows it as soon as
            it is.
          </p>
        </div>
      ) : (
        <p>
          <button className="ep-btn ep-btn-primary" onClick={join} disabled={busy}>
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
