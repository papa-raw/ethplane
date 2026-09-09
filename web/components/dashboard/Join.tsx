'use client';
import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE } from '@/lib/api';

export type JoinResult = { guestName: string; wallet: string; returning?: boolean };

/**
 * Login, then one call to POST /api/join, which verifies the Privy token server-side and hands back
 * a name under ethplane.eth. The page never signs anything and never sees a key: the ENS
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

  if (!ready) return <p data-testid="join-loading" className="text-muted-foreground">starting…</p>;

  if (!authenticated) {
    return (
      <Card data-testid="join-signed-out">
        <CardHeader><CardTitle className="text-base">Join the plane</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Sign in with an email or a wallet. You get a name under ethplane.eth and an embedded
            wallet if you do not have one, and you can start a session on any open node, exactly like
            any other contributor.
          </p>
          <Button onClick={login}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="join-signed-in">
      <CardHeader><CardTitle className="text-base">You are in</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-mono text-xs text-muted-foreground break-all">
          {wallets[0]?.address ?? user?.wallet?.address ?? 'no wallet yet'}
        </p>
        {result ? (
          <div data-testid="join-result" className="space-y-1">
            <p className="text-lg font-medium">{result.guestName}.ethplane.eth</p>
            <p className="text-muted-foreground">
              {result.returning ? 'Welcome back — the same name as last time.' : 'Your name is reserved.'}{' '}
              It is registered on chain by the maintainer shortly; the dashboard shows it as soon as it is.
            </p>
          </div>
        ) : (
          <Button onClick={join} disabled={busy}>{busy ? 'taking…' : 'Take my name'}</Button>
        )}
        {error ? <p data-testid="join-error" className="text-sm text-red-600">{error}</p> : null}
        <button onClick={logout} className="text-xs text-muted-foreground underline">sign out</button>
      </CardContent>
    </Card>
  );
}
