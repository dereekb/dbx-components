import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';

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
   * What to do when `unique` is set and another user already holds the account. Defaults to `block`.
   */
  readonly onCollision?: Maybe<UserExternalConnectionCollisionPolicy>;
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
  onCollision: 'block'
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
  readonly onCollision: UserExternalConnectionCollisionPolicy;
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
    onCollision: policy?.onCollision ?? DEFAULT_USER_EXTERNAL_CONNECTION_PROVIDER_POLICY.onCollision ?? 'block'
  };
}

/**
 * Creates a {@link UserExternalConnectionProviderPolicyRegistry} from the app's declarations.
 *
 * @param policies - The per-provider policies the app declares. Providers absent from the list take
 *   the default policy.
 * @returns The registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionProviderPolicyRegistry(policies?: Maybe<readonly UserExternalConnectionProviderPolicy[]>): UserExternalConnectionProviderPolicyRegistry {
  const map = new Map<UserExternalConnectionProviderType, UserExternalConnectionProviderPolicy>((policies ?? []).map((x) => [x.providerType, x]));
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
