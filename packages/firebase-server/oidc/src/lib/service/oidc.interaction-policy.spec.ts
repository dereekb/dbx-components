import { describe, it, expect } from 'vitest';
import { interactionPolicy, type KoaContextWithOIDC } from 'oidc-provider';
import { STALE_SESSION_ACCOUNT_CHECK_REASON, buildOidcInteractionPolicy } from './oidc.interaction-policy';

/**
 * Minimal stand-in for the parts of the koa context the stale-session check reads.
 *
 * @param oidc - The `session.accountId` / `account` pair to expose on `ctx.oidc`.
 * @returns A context object shaped enough for the check under test.
 */
function contextForOidc(oidc: { accountId?: string; account?: object }): KoaContextWithOIDC {
  return { oidc: { session: { accountId: oidc.accountId }, account: oidc.account } } as unknown as KoaContextWithOIDC;
}

describe('buildOidcInteractionPolicy()', () => {
  const policy = buildOidcInteractionPolicy(interactionPolicy);
  const loginPrompt = policy.get('login');
  const check = loginPrompt?.checks.get(STALE_SESSION_ACCOUNT_CHECK_REASON);

  it('keeps the default login and consent prompts', () => {
    expect(policy.map((prompt) => prompt.name)).toEqual(['login', 'consent']);
  });

  it('installs the stale-session check on the login prompt', () => {
    expect(check).toBeDefined();
  });

  describe('stale session check', () => {
    // The crash case: the `_session` cookie names an account `findAccount` no longer resolves, so
    // `loadGrant` never establishes `oidc.grant` and the consent prompt would dereference undefined.
    it('requests the login prompt when the session account no longer resolves', async () => {
      expect(await check?.check(contextForOidc({ accountId: 'deleted-user' }))).toBe(interactionPolicy.Check.REQUEST_PROMPT);
    });

    it('does not request a prompt when the session account resolves', async () => {
      expect(await check?.check(contextForOidc({ accountId: 'live-user', account: { accountId: 'live-user' } }))).toBe(interactionPolicy.Check.NO_NEED_TO_PROMPT);
    });

    // No session at all is the default `no_session` check's job; this one must stay out of its way.
    it('does not request a prompt when there is no session account', async () => {
      expect(await check?.check(contextForOidc({}))).toBe(interactionPolicy.Check.NO_NEED_TO_PROMPT);
    });
  });
});
