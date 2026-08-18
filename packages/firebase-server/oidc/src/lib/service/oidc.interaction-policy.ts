import { type interactionPolicy, type KoaContextWithOIDC } from 'oidc-provider';

/**
 * Reason string of the check {@link buildOidcInteractionPolicy} adds to the `login` prompt.
 */
export const STALE_SESSION_ACCOUNT_CHECK_REASON = 'stale_session_account';

/**
 * The `interactionPolicy` namespace as imported at runtime.
 *
 * Passed in rather than imported here because `oidc-provider` is ESM-only and the service reaches
 * it through a dynamic `import()`; taking it as an argument keeps this module synchronously
 * testable.
 */
export type OidcInteractionPolicyNamespace = typeof interactionPolicy;

/**
 * Builds the interaction policy: oidc-provider's default prompts, plus a `login` check that
 * catches a session whose account no longer resolves.
 *
 * The default policy crashes on that case. `login`'s `no_session` check passes on
 * `oidc.session.accountId` alone — the value in the `_session` cookie — while `loadAccount` puts
 * the result of `findAccount` on `oidc.account`, and `loadGrant` establishes `oidc.grant` ONLY when
 * that account resolved. So a cookie naming a deleted account skips the login prompt, reaches the
 * `consent` prompt's `op_scopes_missing` check, and dereferences `oidc.grant.getOIDCScopeEncountered()`
 * on `undefined` — a `TypeError` that oidc-provider renders as an opaque `server_error`, on every
 * authorization request, until the user clears the cookie by hand.
 *
 * Deleted accounts are ordinary: an emulator database reset in development, an account deletion in
 * production. Re-authenticating is the correct response, so this requests the `login` prompt and the
 * user recovers by logging in. The check is added to `login` rather than guarding `consent` so the
 * prompt loop short-circuits before any consent check runs (it breaks on the first prompt that
 * fires).
 *
 * @param policyNamespace - The `interactionPolicy` namespace from the runtime `oidc-provider` import.
 * @returns The default policy with the stale-session check installed on the `login` prompt.
 */
export function buildOidcInteractionPolicy(policyNamespace: OidcInteractionPolicyNamespace): interactionPolicy.DefaultPolicy {
  const { base, Check } = policyNamespace;
  const policy = base();
  const loginPrompt = policy.get('login');

  if (loginPrompt) {
    const staleSessionAccountCheck = new Check(STALE_SESSION_ACCOUNT_CHECK_REASON, 'End-User authentication is required', 'login_required', (ctx: KoaContextWithOIDC) => {
      const { oidc } = ctx;
      return oidc.session?.accountId && !oidc.account ? Check.REQUEST_PROMPT : Check.NO_NEED_TO_PROMPT;
    });

    // Placed after `login_prompt`/`no_session` (appended) — order within a prompt only affects which
    // reason is reported when several fire, and a stale account is the more specific diagnosis.
    loginPrompt.checks.add(staleSessionAccountCheck);
  }

  return policy;
}
