import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type UserExternalConnectionExternalAccountId, type UserExternalConnectionFirestoreCollections, type UserExternalConnectionProviderType, userExternalConnectionsWithExternalAccountQuery } from '@dereekb/firebase';
import { type FirebaseServerAuthService, getAuthUserOrUndefined } from '@dereekb/firebase-server';
import { userExternalConnectionSignInDeniedError, userExternalConnectionSignInEmailConflictError, userExternalConnectionSignInUserMissingError } from './userexternalconnection.error';

// MARK: Identity
/**
 * What a provider reported about the account a sign-in is being attempted with.
 *
 * Every field is read SERVER-SIDE from a token the server itself obtained. Nothing here may come
 * from the client: an `id_token` handed over by a browser is unverified (nothing in this workspace
 * is a JWKS verifier), and accepting one would let a caller assert any identity it liked.
 */
export interface UserExternalConnectionSignInIdentity {
  /**
   * The provider's STABLE id for the account — a Discord snowflake, not a username.
   *
   * Identity is keyed on this and nothing else. Usernames are mutable on most providers (Discord
   * made them so in 2023), so keying on one would hand an account over to whoever claimed the name
   * next.
   */
  readonly externalAccountId: UserExternalConnectionExternalAccountId;
  /**
   * The account's email, when the provider reported one.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * Whether the PROVIDER considers that email verified.
   *
   * Load-bearing: an unverified third-party email matching an existing Firebase user is an
   * account-takeover vector, so linking on email is refused unless this is true AND the app opted in.
   */
  readonly emailVerified?: Maybe<boolean>;
  /**
   * Human-readable label for the account, e.g. a display name.
   */
  readonly label?: Maybe<string>;
}

// MARK: Delegate
/**
 * Input handed to a {@link UserExternalConnectionSignInDelegate}.
 */
export interface UserExternalConnectionSignInInput {
  readonly providerType: UserExternalConnectionProviderType;
  readonly identity: UserExternalConnectionSignInIdentity;
  /**
   * The uid already holding this external account, when one does.
   *
   * Set means "a returning user"; absent means "nobody in this project has ever signed in as this
   * third-party account", which is the decision the delegate exists to make.
   */
  readonly existingUid?: Maybe<FirebaseAuthUserId>;
}

/**
 * What the app decided to do about a sign-in attempt.
 */
export type UserExternalConnectionSignInResolution = UserExternalConnectionSignInResolutionSignIn | UserExternalConnectionSignInResolutionCreateUser | UserExternalConnectionSignInResolutionDeny;

export interface UserExternalConnectionSignInResolutionSignIn {
  readonly action: 'signIn';
  readonly uid: FirebaseAuthUserId;
}

export interface UserExternalConnectionSignInResolutionCreateUser {
  readonly action: 'createUser';
  readonly email?: Maybe<EmailAddress>;
  readonly displayName?: Maybe<string>;
  /**
   * Claims to set on the newly created user, before the custom token is minted.
   */
  readonly claims?: Maybe<object>;
}

export interface UserExternalConnectionSignInResolutionDeny {
  readonly action: 'deny';
  /**
   * Why the sign-in was refused. Logged server-side; never returned to the browser, since it may
   * describe why an account does not qualify.
   */
  readonly reason: string;
}

/**
 * Decides whether a third-party identity may sign in, and as whom.
 *
 * This is the app's policy hook and the ONLY place that decision is made. It is an abstract class so
 * it is its own injection token, matching the other members of this module.
 *
 * The library default is {@link denyNewUserSignInDelegate} — a returning user signs in, a stranger is
 * refused. Provisioning strangers is an explicit opt-in, because a sign-in endpoint that creates
 * users is an unauthenticated account-creation surface.
 */
export abstract class UserExternalConnectionSignInDelegate {
  abstract readonly resolveSignIn: (input: UserExternalConnectionSignInInput) => Promise<UserExternalConnectionSignInResolution>;
}

/**
 * The DEFAULT sign-in delegate: an existing user signs in, an unrecognized one is refused.
 *
 * Deny-by-default because the alternative — creating a Firebase user for anyone who can complete a
 * consent screen at a third party — is a decision an app has to make deliberately. Pair with
 * {@link autoCreateUserSignInDelegate} when open registration IS the intent.
 *
 * @returns A delegate that never provisions a new user.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function denyNewUserSignInDelegate(): UserExternalConnectionSignInDelegate {
  return {
    resolveSignIn: async (input) => (input.existingUid ? { action: 'signIn', uid: input.existingUid } : { action: 'deny', reason: `No existing user is connected to this "${input.providerType}" account.` })
  };
}

/**
 * Configuration for {@link autoCreateUserSignInDelegate}.
 */
export interface AutoCreateUserSignInDelegateConfig {
  /**
   * Whether to carry the provider's email onto the created Firebase user.
   *
   * Defaults to true, and applies ONLY to the created user's own record — it does not permit
   * adopting an existing account that already holds the email. That is
   * {@link UserExternalConnectionSignInServiceConfig.allowVerifiedEmailLinking}.
   */
  readonly useProviderEmail?: Maybe<boolean>;
}

/**
 * An OPT-IN sign-in delegate that provisions a new user for an unrecognized third-party account.
 *
 * Open registration. Use it when anyone able to authenticate at the provider is meant to get an
 * account; use a bespoke delegate when they are not (checking a subscription, a guild membership, or
 * an invite list before returning `createUser`).
 *
 * @param config - Optional configuration.
 * @returns A delegate that creates a user on a miss.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function autoCreateUserSignInDelegate(config?: Maybe<AutoCreateUserSignInDelegateConfig>): UserExternalConnectionSignInDelegate {
  const useProviderEmail = config?.useProviderEmail ?? true;

  return {
    resolveSignIn: async (input) => (input.existingUid ? { action: 'signIn', uid: input.existingUid } : { action: 'createUser', email: useProviderEmail ? input.identity.email : null, displayName: input.identity.label })
  };
}

// MARK: Service
/**
 * Input for {@link UserExternalConnectionSignInService.resolveSignIn}.
 */
export interface ResolveUserExternalConnectionSignInInput {
  readonly providerType: UserExternalConnectionProviderType;
  readonly identity: UserExternalConnectionSignInIdentity;
}

/**
 * The uid a sign-in resolved to.
 */
export interface UserExternalConnectionSignInResult {
  readonly uid: FirebaseAuthUserId;
  /**
   * Whether a new Firebase user was provisioned for this sign-in.
   */
  readonly created: boolean;
}

/**
 * Resolves a third-party identity to a Firebase uid and mints the custom token that signs them in.
 *
 * Split out of the OAuth service so the identity → uid decision, which is app policy, is not tangled
 * with any one provider's OAuth mechanics — and so a provider adapter needs no knowledge of Firebase
 * Auth at all.
 *
 * Optional to provide: an app that only ever CONNECTS providers never registers one, and its OAuth
 * services then reject sign-in requests outright.
 */
export abstract class UserExternalConnectionSignInService {
  /**
   * Resolves the uid a third-party identity signs in as, provisioning one if the app's delegate says
   * to.
   */
  abstract readonly resolveSignIn: (input: ResolveUserExternalConnectionSignInInput) => Promise<UserExternalConnectionSignInResult>;
  /**
   * Mints the Firebase custom token the client exchanges via `signInWithCustomToken`.
   */
  abstract readonly mintCustomTokenForUser: (input: UserExternalConnectionMintCustomTokenInput) => Promise<string>;
}

export interface UserExternalConnectionMintCustomTokenInput {
  readonly uid: FirebaseAuthUserId;
}

/**
 * Configuration for {@link userExternalConnectionSignInService}.
 */
export interface UserExternalConnectionSignInServiceConfig extends UserExternalConnectionFirestoreCollections {
  readonly authService: FirebaseServerAuthService;
  /**
   * The app's policy hook. Defaults to {@link denyNewUserSignInDelegate}.
   */
  readonly delegate?: Maybe<UserExternalConnectionSignInDelegate>;
  /**
   * Whether a `createUser` resolution may ADOPT an existing Firebase user whose email matches the
   * provider's — and only when the provider reported that email VERIFIED.
   *
   * Defaults to false. Even with a verified email this is a policy choice rather than an obviously
   * safe one: it means whoever controls the third-party account controls the Firebase account. The
   * safe alternative is an explicit link step performed by an already-signed-in user, which is what
   * the connect flow already is.
   */
  readonly allowVerifiedEmailLinking?: Maybe<boolean>;
}

/**
 * Creates the {@link UserExternalConnectionSignInService}.
 *
 * User creation deliberately does NOT go through `AbstractFirebaseServerNewUserService.initializeNewUser()`:
 * that assigns a random six-digit password and writes a setup-password claim, which are INVITATION
 * semantics. A federated sign-in has no password and needs no setup step, so `auth.createUser()` is
 * called directly.
 *
 * @param config - The auth service, the public collection, and the app's delegate.
 * @returns The sign-in service.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionSignInService(config: UserExternalConnectionSignInServiceConfig): UserExternalConnectionSignInService {
  const { authService, userExternalConnectionCollection } = config;
  const delegate = config.delegate ?? denyNewUserSignInDelegate();
  const allowVerifiedEmailLinking = config.allowVerifiedEmailLinking ?? false;

  async function readExistingUid(input: ResolveUserExternalConnectionSignInInput): Promise<Maybe<FirebaseAuthUserId>> {
    const docs = await userExternalConnectionCollection.queryDocument(userExternalConnectionsWithExternalAccountQuery({ providerType: input.providerType, externalAccountId: input.identity.externalAccountId })).getDocs();
    // the document id IS the uid, so no read of the document body is needed to answer "who is this?"
    return docs[0]?.id;
  }

  async function uidForCreateUser(providerType: UserExternalConnectionProviderType, resolution: UserExternalConnectionSignInResolutionCreateUser, identity: UserExternalConnectionSignInIdentity): Promise<UserExternalConnectionSignInResult> {
    const email = resolution.email;
    const existingByEmail = email ? await getAuthUserOrUndefined(authService.auth.getUserByEmail(email)) : undefined;
    let result: UserExternalConnectionSignInResult;

    if (existingByEmail != null) {
      // adopting an account on an UNVERIFIED third-party email hands it to whoever controls that
      // email; even verified, linking is a policy choice an app has to opt into
      if (allowVerifiedEmailLinking && identity.emailVerified) {
        result = { uid: existingByEmail.uid, created: false };
      } else {
        throw userExternalConnectionSignInEmailConflictError(providerType);
      }
    } else {
      const created = await authService.auth.createUser({
        ...(email ? { email } : undefined),
        ...(resolution.displayName ? { displayName: resolution.displayName } : undefined)
      });

      result = { uid: created.uid, created: true };
    }

    if (resolution.claims) {
      await authService.userContext(result.uid).updateClaims(resolution.claims);
    }

    return result;
  }

  async function resolveSignIn(input: ResolveUserExternalConnectionSignInInput): Promise<UserExternalConnectionSignInResult> {
    const { providerType, identity } = input;
    const existingUid = await readExistingUid(input);
    const resolution = await delegate.resolveSignIn({ providerType, identity, existingUid });
    let result: UserExternalConnectionSignInResult;

    switch (resolution.action) {
      case 'signIn': {
        // a uid the delegate named may have been deleted from Firebase Auth since the connection was
        // written — minting a token for it would produce a signed-in user with no record
        const record = await getAuthUserOrUndefined(authService.auth.getUser(resolution.uid));

        if (record == null) {
          throw userExternalConnectionSignInUserMissingError(providerType);
        }

        result = { uid: resolution.uid, created: false };
        break;
      }
      case 'createUser':
        result = await uidForCreateUser(providerType, resolution, identity);
        break;
      case 'deny':
        throw userExternalConnectionSignInDeniedError(providerType, resolution.reason);
    }

    return result;
  }

  function mintCustomTokenForUser(input: UserExternalConnectionMintCustomTokenInput): Promise<string> {
    return authService.userContext(input.uid).mintCustomToken();
  }

  return { resolveSignIn, mintCustomTokenForUser };
}

/**
 * Reference to a {@link UserExternalConnectionSignInService} instance.
 */
export interface UserExternalConnectionSignInServiceRef {
  readonly userExternalConnectionSignInService: UserExternalConnectionSignInService;
}
