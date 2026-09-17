import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { type Maybe, type Seconds, unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { type OidcEntry, type OidcScope, OIDC_ENTRY_CLI_TOKEN_CLAIM_TYPE } from '@dereekb/firebase';
import { assertEndpointOidcScope, badRequestError, clientIpsMatch, forbiddenError, type FirebaseServerAuthData, notFoundError, oidcScopesFromRequestAuth, unauthenticatedError } from '@dereekb/firebase-server';
import { OidcModuleConfig } from '../oidc.config';
import { OidcService } from '../service/oidc.service';
import { OidcEncryptionService } from '../service/oidc.encryption.service';
import { OidcServerFirestoreCollections } from '../model/model';
import { DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM } from '../service/oidc.session-ttl';
import {
  CLI_TOKEN_ADMIN_PREDICATE,
  CLI_TOKEN_CLAIM_CODE_BYTES,
  CLI_TOKEN_CLAIM_TTL_SECONDS,
  resolveCliTokenClientId,
  type CliTokenAdminPredicate,
  CliTokenApiModuleConfig,
  type CliTokenHandoffBundle,
  type CliTokenMintResult,
  DEFAULT_CLI_TOKEN_REQUIRED_OIDC_SCOPE,
  FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH,
  resolveCliTokenScopes,
  resolveCliTokenTtlSeconds
} from './oidc.cli-token.config';

// MARK: Errors
/**
 * Error code thrown when the caller is not authorized to mint a CLI credential.
 */
export const CLI_TOKEN_FORBIDDEN_ERROR_CODE = 'CLI_TOKEN_FORBIDDEN_ERROR';

/**
 * Error code thrown when the app did not configure a usable CLI client, so minting is disabled.
 */
export const CLI_TOKEN_DISABLED_ERROR_CODE = 'CLI_TOKEN_DISABLED_ERROR';

/**
 * Error code returned for EVERY failed claim redemption — not found, expired, and already-consumed
 * alike. Deliberately undifferentiated so the unauthenticated claim endpoint is not an oracle a
 * caller can probe for valid codes.
 */
export const CLI_TOKEN_CLAIM_INVALID_ERROR_CODE = 'CLI_TOKEN_CLAIM_INVALID_ERROR';

const CLI_TOKEN_CLAIM_INVALID_MESSAGE = 'The claim code is invalid, expired, or has already been used.';

// MARK: Params
/**
 * Body of `POST /oidc/cli-token`.
 */
export interface MintCliTokenParams {
  /**
   * An optional subset of the caller's own scopes to grant. May only NARROW — a scope the caller
   * does not hold is ignored.
   */
  readonly scopes?: Maybe<readonly OidcScope[]>;
  /**
   * An optional requested lifetime in seconds. Clamped to one hour and to the remaining life of the
   * caller's own grant.
   */
  readonly ttlSeconds?: Maybe<Seconds>;
}

/**
 * Body of `POST /oidc/cli-token/claim`.
 */
export interface ClaimCliTokenParams {
  readonly code: string;
}

/**
 * The payload persisted behind a claim code. Everything but `refreshToken` is non-secret; the
 * refresh token is encrypted at rest with the OIDC encryption provider before it is written.
 */
interface StoredCliTokenClaimPayload {
  readonly uid: string;
  readonly clientId: string;
  readonly scope: string;
  readonly expiresAt: string;
  /**
   * The refresh token, encrypted. Named distinctly from the adapter's own `refresh_token` field so
   * nothing mistakes this entry for an oidc-provider RefreshToken record.
   */
  readonly encryptedRefreshToken: string;
  readonly apiBaseUrl?: string;
  /**
   * The env name the app configured, recorded at mint so the claim can echo it without re-reading
   * config that may have changed between mint and redeem.
   */
  readonly envName?: string;
  /**
   * The address the mint was called from, recorded only when `bindClaimToMintIp` is enabled. Absent
   * on a claim minted while the option was off, which redeems from anywhere as before.
   */
  readonly mintIp?: string;
}

/**
 * Per-request context for a mint or claim, carrying what the transport layer observed.
 */
export interface CliTokenRequestContext {
  /**
   * The calling client's address, as resolved by the controller.
   */
  readonly requestIp?: Maybe<string>;
}

// MARK: Service
/**
 * Mints a short-lived CLI login credential for the caller, and redeems the one-time claim code that
 * carries it.
 *
 * ## Security
 *
 * Gates apply in this order, mirroring `FirestoreSessionApiService`:
 *
 * 1. `auth?.uid` present, else unauthenticated.
 * 2. The app-supplied {@link CliTokenAdminPredicate} — the load-bearing check. **Fails closed** when
 *    the app provides no predicate.
 * 3. The `token.cli` OIDC scope — defence in depth only. It cannot stand alone: a non-OIDC caller
 *    carries no `scope` claim and every enforcement site treats that as "skip".
 * 4. A configured, provider-resolvable CLI `client_id`, else the endpoint is disabled.
 *
 * The minted credential is never MORE privileged than the session that minted it: its scopes are the
 * caller's own, minus `token.cli` / `token.service` (see {@link resolveCliTokenScopes}), and its TTL
 * is capped at one hour AND at the remaining life of the caller's own grant.
 *
 * ## Accepted limitation — no revocation cascade
 *
 * A refresh token is CLIENT-BOUND: oidc-provider's `validateGrant` requires
 * `grant.clientId === client.clientId`, so the parent grant (owned by the MCP client) cannot be
 * reused for the CLI client and a **separate** Grant must be created. Revoking the parent session
 * therefore does NOT cascade to the minted credential. The ≤1h cap is the mitigation; `auth logout
 * --revoke` and the `deleteOidcToken` callModel action are the manual kill switches.
 *
 * Rotation is deliberately left ON (the scope is NOT added to `nonRotatingScopes`): the CLI client is
 * a public PKCE client, so oidc-provider rotates the refresh token on every exchange and its reuse
 * detection kills the whole grant if a stolen copy is replayed. That is why the credential must land
 * in the CLI's PERSISTED token cache rather than the non-persisting `fromEnv` path.
 */
@Injectable()
export class OidcCliTokenService {
  private readonly _logger = new Logger(OidcCliTokenService.name);

  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(OidcModuleConfig) private readonly oidcModuleConfig: OidcModuleConfig,
    @Inject(OidcEncryptionService) private readonly encryptionService: OidcEncryptionService,
    @Inject(OidcServerFirestoreCollections) private readonly collections: OidcServerFirestoreCollections,
    @Optional() @Inject(CliTokenApiModuleConfig) private readonly config?: CliTokenApiModuleConfig,
    @Optional() @Inject(CLI_TOKEN_ADMIN_PREDICATE) private readonly adminPredicate?: CliTokenAdminPredicate
  ) {
    if (!adminPredicate) {
      this._logger.warn(`No ${CLI_TOKEN_ADMIN_PREDICATE} provided — ${FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH} will reject every caller. Provide one from the CLI-token module's dependency module.`);
    }

    if (!config?.cliClientId) {
      this._logger.warn(`No CliTokenApiModuleConfig.cliClientId configured — ${FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH} is disabled.`);
    }
  }

  /**
   * Mints a CLI credential for the calling user and returns the one-time claim code that unwraps it.
   *
   * @param auth - The authenticated request's auth data (`req.auth`).
   * @param params - The optional requested scope subset + TTL.
   * @returns The claim code and the minted credential's metadata. The refresh token itself is NOT returned.
   * @throws {HttpsError} `401` with no uid, `403` when a gate rejects the caller, `400` when minting is disabled.
   */
  async mintCliToken(auth: Maybe<FirebaseServerAuthData>, params: MintCliTokenParams, context?: CliTokenRequestContext): Promise<CliTokenMintResult> {
    const uid = auth?.uid;

    if (!uid) {
      throw unauthenticatedError({ message: 'Minting a CLI credential requires an authenticated caller.' });
    }

    const isAllowed = this.adminPredicate ? await this.adminPredicate(auth) : false;

    if (!isAllowed) {
      throw forbiddenError({
        status: 403,
        code: CLI_TOKEN_FORBIDDEN_ERROR_CODE,
        message: 'Not authorized to mint a CLI credential.'
      });
    }

    // an explicit `null` disables scope enforcement; only an ABSENT value falls back to the default
    const configuredScope = this.config?.requiredScope;
    const callerScopes = oidcScopesFromRequestAuth(auth);

    assertEndpointOidcScope({
      requiredScope: configuredScope === undefined ? DEFAULT_CLI_TOKEN_REQUIRED_OIDC_SCOPE : configuredScope,
      grantedScopes: callerScopes,
      endpoint: FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH
    });

    const cliClientId = await resolveCliTokenClientId(this.config?.cliClientId);

    if (!cliClientId) {
      throw badRequestError({ status: 400, code: CLI_TOKEN_DISABLED_ERROR_CODE, message: 'CLI credential minting is not configured for this app.' });
    }

    const provider = await this.oidcService.getProvider();
    const client = await provider.Client.find(cliClientId);

    if (!client) {
      throw badRequestError({ status: 400, code: CLI_TOKEN_DISABLED_ERROR_CODE, message: 'The configured CLI OAuth client could not be resolved.' });
    }

    const scopeString = resolveCliTokenScopes({ callerScopes, requestedScopes: params.scopes });
    const ttlSeconds = resolveCliTokenTtlSeconds({
      requestedTtlSeconds: params.ttlSeconds,
      defaultTtlSeconds: this.config?.defaultTtlSeconds,
      parentRemainingSeconds: parentGrantRemainingSeconds(auth)
    });

    // A NEW grant is required rather than a reuse of the caller's: a refresh token is client-bound,
    // and oidc-provider's `validateGrant` demands `grant.clientId === client.clientId`.
    // `expiresIn` is honoured by Grant#save but is absent from the constructor's published type, so
    // the init object is declared separately (the same shape `findOrCreateGrant` uses).
    const grantInit: { accountId: string; clientId: string; expiresIn?: number } = { accountId: uid, clientId: cliClientId, expiresIn: ttlSeconds };
    const grant = new provider.Grant(grantInit);
    grant.addOIDCScope(scopeString);
    const grantId = await grant.save();

    const refreshToken = new provider.RefreshToken({
      accountId: uid,
      client,
      clientId: cliClientId,
      grantId,
      scope: scopeString,
      gty: 'authorization_code',
      // not bound to an IdP session — there is no interactive session behind a minted credential
      expiresWithSession: false
    });
    // `expiresIn` is a runtime BaseToken field oidc-provider reads at save time; it is not on the
    // published RefreshToken type, hence the narrow cast rather than an `any`.
    (refreshToken as unknown as { expiresIn?: number }).expiresIn = ttlSeconds;
    const refreshTokenValue = await refreshToken.save();

    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + ttlSeconds * 1000).toISOString();
    const claimExpiresAt = new Date(nowMs + CLI_TOKEN_CLAIM_TTL_SECONDS * 1000);
    const claimCode = generateCliTokenClaimCode();

    await this._storeClaim({
      claimCode,
      claimExpiresAt,
      payload: {
        uid,
        clientId: cliClientId,
        scope: scopeString,
        expiresAt,
        encryptedRefreshToken: this.encryptionService.provider.encrypt(refreshTokenValue),
        ...(this.config?.apiBaseUrl ? { apiBaseUrl: this.config.apiBaseUrl } : undefined),
        ...(this.config?.envName ? { envName: this.config.envName } : undefined),
        ...(this.config?.bindClaimToMintIp && context?.requestIp ? { mintIp: context.requestIp } : undefined)
      }
    });

    this._logger.log(`Minted CLI credential: minter=${uid} parentGrant=${parentGrantId(auth) ?? 'unknown'} childGrant=${grantId} client=${cliClientId} scope="${scopeString}" expiresAt=${expiresAt}`);

    // `envName` is returned as well as stored on the claim: the stored copy configures the env AFTER a
    // successful redeem, but the caller needs the name to BUILD the redeem command in the first place.
    return { claimCode, claimExpiresAt: claimExpiresAt.toISOString(), expiresAt, scope: scopeString, ...(this.config?.envName ? { envName: this.config.envName } : undefined) };
  }

  /**
   * Redeems a one-time claim code, consuming it inside a Firestore transaction so a double-redeem
   * loses the race rather than handing out the same credential twice.
   *
   * @param params - The claim code to redeem.
   * @returns The handoff bundle: everything a bare machine needs to be logged in.
   * @throws {HttpsError} A `404` with the SAME generic error for a missing, expired, or already-consumed code.
   */
  async claimCliToken(params: ClaimCliTokenParams, context?: CliTokenRequestContext): Promise<CliTokenHandoffBundle> {
    const code = typeof params?.code === 'string' ? params.code.trim() : '';

    if (code.length === 0) {
      throw this._claimInvalidError();
    }

    const collection = this.collections.oidcEntryCollection;
    const documentId = cliTokenClaimDocumentId(code);

    const payload = await collection.firestoreContext.runTransaction(async (transaction) => {
      const document = collection.documentAccessorForTransaction(transaction).loadDocumentForId(documentId);
      const data = await document.snapshotData();
      let result: Maybe<StoredCliTokenClaimPayload>;

      // `consumed` is set INSIDE the transaction, so a concurrent second redeem reads the same
      // pre-consume snapshot and Firestore aborts one of the two writes.
      if (data != null && data.type === OIDC_ENTRY_CLI_TOKEN_CLAIM_TYPE && data.consumed == null && !hasExpired(data)) {
        const payload = data.payload as unknown as StoredCliTokenClaimPayload;

        // Evaluated INSIDE the transaction alongside the consume, so a mismatched redeem cannot race a
        // matching one. A mismatch deliberately leaves `consumed` unset — the legitimate holder can
        // still redeem — and falls through to the same generic error every other failure returns, so
        // the route does not reveal that a code exists but was called from the wrong address.
        //
        // Only enforced for a claim that actually recorded an address: a code minted while
        // `bindClaimToMintIp` was off redeems from anywhere, as it did when it was issued. Once an
        // address WAS recorded, `clientIpsMatch` normalizes both sides and counts an unresolvable
        // address as a mismatch, so a binding behind a proxy that strips the header fails closed.
        if (payload.mintIp == null || clientIpsMatch(payload.mintIp, context?.requestIp)) {
          result = payload;
          await document.accessor.set({ consumed: unixDateTimeSecondsNumberForNow() } as Partial<OidcEntry>, { merge: true });
        } else {
          this._logger.warn(`Rejected a CLI credential claim from ${context?.requestIp ?? 'an unknown address'} — the code was minted from ${payload.mintIp}.`);
        }
      }

      return result;
    });

    if (payload == null) {
      throw this._claimInvalidError();
    }

    this._logger.log(`Redeemed CLI credential claim: uid=${payload.uid} client=${payload.clientId} expiresAt=${payload.expiresAt}`);

    return {
      uid: payload.uid,
      issuer: this.oidcModuleConfig.issuer,
      clientId: payload.clientId,
      refreshToken: this.encryptionService.provider.decrypt(payload.encryptedRefreshToken),
      scope: payload.scope,
      expiresAt: payload.expiresAt,
      ...(payload.apiBaseUrl ? { apiBaseUrl: payload.apiBaseUrl } : undefined),
      ...(payload.envName ? { envName: payload.envName } : undefined)
    };
  }

  private async _storeClaim(input: { readonly claimCode: string; readonly claimExpiresAt: Date; readonly payload: StoredCliTokenClaimPayload }): Promise<void> {
    const collection = this.collections.oidcEntryCollection;
    const document = collection.documentAccessor().loadDocumentForId(cliTokenClaimDocumentId(input.claimCode));

    const entry: OidcEntry = {
      type: OIDC_ENTRY_CLI_TOKEN_CLAIM_TYPE,
      payload: input.payload as unknown as OidcEntry['payload'],
      uid: input.payload.uid,
      clientId: input.payload.clientId,
      createdAt: new Date(),
      expiresAt: input.claimExpiresAt
    };

    await document.accessor.set(entry, { merge: true });
  }

  // one shape for every failure so the unauthenticated endpoint cannot be probed for valid codes
  private _claimInvalidError() {
    return notFoundError({ status: 404, code: CLI_TOKEN_CLAIM_INVALID_ERROR_CODE, message: CLI_TOKEN_CLAIM_INVALID_MESSAGE });
  }
}

// MARK: Utility
/**
 * Generates a high-entropy, URL-safe one-time claim code.
 *
 * @returns A base64url-encoded random string of {@link CLI_TOKEN_CLAIM_CODE_BYTES} bytes.
 */
export function generateCliTokenClaimCode(): string {
  return randomBytes(CLI_TOKEN_CLAIM_CODE_BYTES).toString('base64url');
}

/**
 * Prefix of the `oidcEntry` document id a pending CLI-token claim is stored under.
 *
 * Namespaced so a claim can never collide with an oidc-provider adapter entry, which keys documents
 * by the provider's own token/grant ids.
 */
export const CLI_TOKEN_CLAIM_DOCUMENT_ID_PREFIX = 'cli-token-claim-';

/**
 * Builds the `oidcEntry` document id for a claim code.
 *
 * The code IS the lookup key — there is no query — so a redeem is a single point read and a wrong
 * code is indistinguishable from an expired one.
 *
 * @param code - The one-time claim code.
 * @returns The namespaced document id.
 * @__NO_SIDE_EFFECTS__
 */
export function cliTokenClaimDocumentId(code: string): string {
  // Firestore document ids may not contain '/'; base64url never emits one, but a hand-typed code
  // could, and a path-shaped id would silently read a different document.
  return `${CLI_TOKEN_CLAIM_DOCUMENT_ID_PREFIX}${code.replaceAll('/', '_')}`;
}

/**
 * Reads the grant id the calling access token was issued against, when present.
 *
 * @param auth - The request auth data.
 * @returns The parent grant id, or `undefined`.
 */
function parentGrantId(auth: Maybe<FirebaseServerAuthData>): Maybe<string> {
  const value = (auth as Maybe<{ oidcValidatedToken?: { grantId?: unknown } }>)?.oidcValidatedToken?.grantId;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reads how many seconds remain on the CALLER's own grant, from the `dbx_session_expires_at` claim
 * baked onto the access token at issuance.
 *
 * Returns `undefined` when the claim is absent (a non-OIDC caller, or a token issued before the
 * claim existed) — the TTL resolver then falls back to the one-hour ceiling alone.
 *
 * @param auth - The request auth data.
 * @returns Remaining seconds on the parent grant, or `undefined`.
 */
function parentGrantRemainingSeconds(auth: Maybe<FirebaseServerAuthData>): Maybe<Seconds> {
  const claims = (auth as Maybe<{ oidcValidatedToken?: Record<string, unknown>; token?: Record<string, unknown> }>) ?? {};
  const raw = claims.oidcValidatedToken?.[DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM] ?? claims.token?.[DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM];
  let result: Maybe<Seconds>;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    result = raw - unixDateTimeSecondsNumberForNow();
  }

  return result;
}

/**
 * Returns true when a stored claim entry is past its `expiresAt`.
 *
 * Firestore may hand back either a `Date` or a `Timestamp`-like value depending on the driver, so
 * both are handled — the adapter's own `_toPayload` does the same.
 *
 * @param data - The stored entry.
 * @returns True when the entry has expired.
 */
function hasExpired(data: OidcEntry): boolean {
  const expiresAt = data.expiresAt;
  let result = false;

  if (expiresAt != null) {
    const date = expiresAt instanceof Date ? expiresAt : (expiresAt as unknown as { toDate(): Date }).toDate();
    result = date.getTime() <= Date.now();
  }

  return result;
}
