import { type Maybe, type Milliseconds, MS_IN_MINUTE, type PromiseOrValue } from '@dereekb/util';
import { EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, type OidcEntryClientId, type OidcScopeTerm, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type UserExternalConnectionResolvedProviderPolicy } from '../userexternalconnection.policy';

// MARK: Defaults
/**
 * Default {@link UserExternalConnectionTokenApiModuleConfig.minimumRemaining}: a minted token has at
 * least this long left, renewing the stored one first when it does not.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING: Milliseconds = 5 * MS_IN_MINUTE;

/**
 * The default {@link UserExternalConnectionTokenApiModuleConfig.requiredScope}.
 */
export const DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_REQUIRED_OIDC_SCOPE: OidcScopeTerm = EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE;

// MARK: Predicate
/**
 * Input for {@link UserExternalConnectionTokenPredicate}.
 */
export interface UserExternalConnectionTokenPredicateInput {
  /**
   * The calling request's auth data. Always carries a uid by the time the predicate runs.
   */
  readonly auth: FirebaseServerAuthData;
  /**
   * The provider whose access token is requested.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * That provider's resolved policy, e.g. so a predicate can honor `adminOnly`.
   */
  readonly policy: UserExternalConnectionResolvedProviderPolicy;
}

/**
 * Authorizes a caller to mint an access token for one of their own external connections.
 *
 * The LOAD-BEARING gate of the token API, supplied by the app because what qualifies a caller (an
 * admin, a subscription tier) is the app's decision. When no predicate is provided the API fails
 * closed for every caller.
 */
export type UserExternalConnectionTokenPredicate = (input: UserExternalConnectionTokenPredicateInput) => PromiseOrValue<boolean>;

/**
 * NestJS injection token for the {@link UserExternalConnectionTokenPredicate} provider.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE = 'USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE';

// MARK: Config
/**
 * Decides whether an OIDC client may mint external connection tokens: either the allowed client ids,
 * or a function deciding per client id.
 */
export type UserExternalConnectionTokenAllowedClientIds = readonly OidcEntryClientId[] | ((clientId: OidcEntryClientId) => PromiseOrValue<boolean>);

/**
 * Optional configuration for the external connection token API, supplied by the app through the
 * module's dependency module.
 */
export abstract class UserExternalConnectionTokenApiModuleConfig {
  /**
   * How long a minted token must still be valid for. Defaults to
   * {@link DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING}.
   */
  readonly minimumRemaining?: Maybe<Milliseconds>;
  /**
   * OIDC scope term an OIDC caller must hold. Defaults to
   * {@link DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_REQUIRED_OIDC_SCOPE}. Pass `null` to disable scope
   * enforcement (the predicate remains the real gate).
   */
  readonly requiredScope?: Maybe<OidcScopeTerm>;
  /**
   * The OIDC clients allowed to mint. When set, the caller's access token must have been issued to one
   * of them — so a token issued to some other OIDC client the user authorized cannot mint, even with
   * the scope.
   */
  readonly allowedClientIds?: Maybe<UserExternalConnectionTokenAllowedClientIds>;
  /**
   * Whether a caller authenticated WITHOUT an OIDC access token (a plain Firebase ID token) may mint.
   * Defaults to false.
   *
   * Off by default because such a caller carries no `scope` claim, so the scope requirement cannot
   * apply to it, and no client id, so neither can {@link allowedClientIds}.
   */
  readonly allowNonOidcCallers?: Maybe<boolean>;
}
