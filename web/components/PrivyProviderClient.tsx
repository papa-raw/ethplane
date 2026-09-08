'use client';
import { PrivyProvider } from '@privy-io/react-auth';

/** Email or wallet, and an embedded wallet created on login, because a judge should not need to own
 *  one already to take part (PRD 3.25). Client-only: the export has no server. */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? 'cmtsrijzf005e0dl5jv3yi8yw';

export function PrivyProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: { theme: 'light' },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
