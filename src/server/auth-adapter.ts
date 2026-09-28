import type { Adapter, AdapterAccount } from "next-auth/adapters";

/** Sign-in only needs the provider account ID, so OAuth tokens are dropped before they reach the database. */
export function withoutOAuthTokens(account: AdapterAccount): AdapterAccount {
  return {
    ...account,
    access_token: undefined,
    refresh_token: undefined,
    id_token: undefined,
    expires_at: undefined,
    session_state: undefined,
  };
}

export function stripOAuthTokens(adapter: Adapter): Adapter {
  const linkAccount = adapter.linkAccount;
  if (!linkAccount) return adapter;
  return { ...adapter, linkAccount: (account) => linkAccount.call(adapter, withoutOAuthTokens(account)) };
}
