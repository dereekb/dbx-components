import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { userExternalConnectionProviderNotAllowedError } from './userexternalconnection.error';
import { type UserExternalConnectionOAuthProviderRegistry } from './oauth/userexternalconnection.oauth.registry';

/**
 * What happens when the external account being connected is already held by a different user.
 *
 * - `block` — refuse the connect. The default, and the only one that is safe without thought.
 * - `transfer` — disconnect the prior holder in the same transaction and connect the new one. Right
 *   when the third-party account is the identity of record and a person may have created a stray
 *   Firebase user by another route.
 * - `allow` — permit both. Correct only for a provider whose accounts are legitimately shared
 *   (a team's shared Zoom account, say), and incompatible with using that provider to sign in.
 */
export type UserExternalConnectionCollisionPolicy = 'block' | 'transfer' | 'allow';

/**
 * Per-provider rules the connect and sign-in paths enforce.
 *
 * Declared by the app rather than by the provider adapter: whether two users may share a Discord
 * account, and whether Discord may be used to log in at all, are product decisions, not facts about
 * Discord's API.
 */
export interface UserExternalConnectionProviderPolicy {
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * At most one Firebase user per external account. Defaults to false.
   *
   * A provider used for SIGN-IN should almost always be unique — otherwise "who is this account?" has
   * more than one answer and the sign-in resolves arbitrarily.
   *
   * Do not turn this on for a provider with existing connections until the `ec` backfill has run:
   * uniqueness is enforced against `ec`, and a document written before that field existed has none.
   */
  readonly unique?: Maybe<boolean>;
  /**
   * The provider may be used to sign in. Defaults to FALSE.
   *
   * Opt-in because enabling it turns `/oauth/<provider>/signin` into an unauthenticated
   * account-creation surface; registering a provider for the connect direction must not silently
   * grant that.
   */
  readonly signIn?: Maybe<boolean>;
  /**
   * A SIGN-IN through this provider also establishes the DATA connection, storing the credentials the
   * sign-in exchange produced. Defaults to FALSE.
   *
   * Off by default because the two grants are not the same grant. A sign-in requests the identity
   * scopes (`identify`, `email`); a data connection requests whatever the integration actually reads.
   * Writing the sign-in's credentials into the data connection therefore REPLACES a broad grant with a
   * narrow one every time the user signs in — silently downgrading a working integration.
   *
   * Turn it on only for an app whose sign-in scopes are a superset of its data scopes, or one that has
   * no data integration and just wants the connection row to show up.
   */
  readonly signInConnects?: Maybe<boolean>;
  /**
   * What to do when `unique` is set and another user already holds the account. Defaults to `block`.
   */
  readonly onCollision?: Maybe<UserExternalConnectionCollisionPolicy>;
  /**
   * Only an admin may connect this provider. Defaults to FALSE.
   *
   * Enforced where the connect/link state is minted (see `assertUserExternalConnectionProviderConnectable()`):
   * a non-admin is refused exactly as if the provider were not mounted, so the endpoint does not reveal
   * that admin-only providers exist. Disconnecting and unlinking stay open, so a demoted admin can still
   * clean up.
   *
   * Incompatible with {@link signIn}: a sign-in is unauthenticated, so whether the caller is an admin is
   * unknowable until a user may already have been created. The registry refuses the combination.
   */
  readonly adminOnly?: Maybe<boolean>;
  /**
   * The connection's ACCESS token may be minted out to the user it belongs to through the external
   * connection token API (`UserExternalConnectionTokenApiService`). Defaults to FALSE.
   *
   * Opt-in, per provider, because a minted token leaves the server and can be used off-platform with
   * every scope the connection was granted. Only the access token and its metadata leave: never the
   * refresh token or the OAuth client secret. The token API applies its own gates too (an app predicate,
   * an OIDC scope and client allowlist); this flag is the app's declaration that the provider may be
   * exported at all.
   */
  readonly tokenExport?: Maybe<boolean>;
}

/**
 * The policy applied to a provider the app declared nothing for.
 *
 * Every field is the restrictive option: an unlisted provider behaves exactly as it did before
 * policies existed (shared accounts permitted, connect-only), so adding the registry changes no
 * existing app's behavior.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY: Omit<Required<UserExternalConnectionProviderPolicy>, 'providerType'> = {
  unique: false,
  signIn: false,
  signInConnects: false,
  onCollision: 'block',
  adminOnly: false,
  tokenExport: false
};

/**
 * Resolves the {@link UserExternalConnectionProviderPolicy} for a provider.
 *
 * An abstract class so it is its own injection token. Optional to provide — a missing registry reads
 * as "every provider takes the default policy".
 */
export abstract class UserExternalConnectionProviderPolicyRegistry {
  abstract readonly policyForProviderType: (providerType: UserExternalConnectionProviderType) => UserExternalConnectionResolvedProviderPolicy;
}

/**
 * A policy with every optional field resolved, so enforcement sites never re-apply defaults.
 */
export interface UserExternalConnectionResolvedProviderPolicy {
  readonly providerType: UserExternalConnectionProviderType;
  readonly unique: boolean;
  readonly signIn: boolean;
  readonly signInConnects: boolean;
  readonly onCollision: UserExternalConnectionCollisionPolicy;
  readonly adminOnly: boolean;
  readonly tokenExport: boolean;
}

/**
 * Resolves a declared policy against {@link DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY}.
 *
 * @param providerType - The provider being resolved.
 * @param policy - The app's declaration for it, when there is one.
 * @returns The policy with every field populated.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveUserExternalConnectionProviderPolicy(providerType: UserExternalConnectionProviderType, policy?: Maybe<UserExternalConnectionProviderPolicy>): UserExternalConnectionResolvedProviderPolicy {
  return {
    providerType,
    // `??` alone is not enough: an explicitly-null field is a legal `Maybe` and must fall back too
    unique: policy?.unique ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.unique ?? false,
    signIn: policy?.signIn ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.signIn ?? false,
    signInConnects: policy?.signInConnects ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.signInConnects ?? false,
    onCollision: policy?.onCollision ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.onCollision ?? 'block',
    adminOnly: policy?.adminOnly ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.adminOnly ?? false,
    tokenExport: policy?.tokenExport ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.tokenExport ?? false
  };
}

/**
 * Creates a {@link UserExternalConnectionProviderPolicyRegistry} from the app's declarations.
 *
 * @param policies - The per-provider policies the app declares. Providers absent from the list take
 *   the default policy.
 * @returns The registry.
 * @throws {Error} When a policy is both `adminOnly` and `signIn`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionProviderPolicyRegistry(policies?: Maybe<readonly UserExternalConnectionProviderPolicy[]>): UserExternalConnectionProviderPolicyRegistry {
  const declared = policies ?? [];
  const adminOnlySignIn = declared.find((x) => x.adminOnly && x.signIn);

  if (adminOnlySignIn) {
    throw new Error(`UserExternalConnectionProviderPolicy for "${adminOnlySignIn.providerType}" is both adminOnly and signIn. A sign-in is unauthenticated, so an admin-only provider cannot be used to sign in.`);
  }

  const map = new Map<UserExternalConnectionProviderType, UserExternalConnectionProviderPolicy>(declared.map((x) => [x.providerType, x]));
  return { policyForProviderType: (providerType) => resolveUserExternalConnectionProviderPolicy(providerType, map.get(providerType)) };
}

/**
 * Resolves a provider's policy, treating a missing registry as "all defaults".
 *
 * The registry is optional, so every enforcement site would otherwise repeat this fallback.
 *
 * @param registry - The registry, when the app provided one.
 * @param providerType - The provider to resolve.
 * @returns The resolved policy.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionPolicyForProviderType(registry: Maybe<UserExternalConnectionProviderPolicyRegistry>, providerType: UserExternalConnectionProviderType): UserExternalConnectionResolvedProviderPolicy {
  return registry ? registry.policyForProviderType(providerType) : resolveUserExternalConnectionProviderPolicy(providerType);
}

// MARK: Connectable
/**
 * Input for {@link assertUserExternalConnectionProviderConnectable}.
 */
export interface AssertUserExternalConnectionProviderConnectableInput {
  /**
   * The app's mounted OAuth flows.
   */
  readonly oauthRegistry: UserExternalConnectionOAuthProviderRegistry;
  /**
   * The app's provider policies, when it declared any.
   */
  readonly policyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Whether the caller is an admin, by the app's own definition (typically `isAdminInRequest(request)`).
   */
  readonly isAdmin: boolean;
}

/**
 * Asserts the caller may begin connecting (or linking) a provider: the app has an OAuth flow mounted
 * for it, and the provider is not `adminOnly` unless the caller is an admin.
 *
 * Meant for the place the connect/link state is minted — every later step of the handoff is bound to
 * that state, so this one check covers the whole flow.
 *
 * A non-admin asking for an admin-only provider gets the SAME error as a provider that is not mounted,
 * so the endpoint does not reveal which admin-only providers exist.
 *
 * @param input - The registries, provider and caller's admin status.
 * @returns The provider's resolved policy.
 * @throws A precondition-conflict HttpsError when the provider is not mounted or is admin-only and the caller is not an admin.
 */
export function assertUserExternalConnectionProviderConnectable(input: AssertUserExternalConnectionProviderConnectableInput): UserExternalConnectionResolvedProviderPolicy {
  const { oauthRegistry, policyRegistry, providerType, isAdmin } = input;
  oauthRegistry.assertHasAuthorizeFlowForProviderType(providerType);

  const policy = userExternalConnectionPolicyForProviderType(policyRegistry, providerType);

  if (policy.adminOnly && !isAdmin) {
    throw userExternalConnectionProviderNotAllowedError(providerType);
  }

  return policy;
}
