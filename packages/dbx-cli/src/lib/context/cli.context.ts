import type { FirestoreContext, OnCallTypedModelParams } from '@dereekb/firebase';
import type { Maybe } from '@dereekb/util';
import { type CliEnvConfig } from '../config/env';
import { callModelOverHttp, getModelOverHttp, getMultipleModelsOverHttpChunked, type GetModelOverHttpResult, type GetMultipleModelsOverHttpResult } from '../api/call-model.client';
import { type CliFirestoreSessionContext, createCliFirestoreSessionContext } from '../firestore/firestore.session';
import { type CliModelManifest } from '../manifest/types';
import { createContextSlot } from '../util/context.slot';
import { CliError } from '../util/output';

/**
 * The CLI context attached to argv by the auth middleware.
 *
 * Holds the active env, the current access token, and helpers that perform HTTP calls against
 * `<env.apiBaseUrl>/model/*`:
 *  - {@link CliContext.callModel} → `POST /model/call` (typed model dispatch)
 *  - {@link CliContext.getModel} → `GET /model/<modelType>/get?key=<key>`
 *  - {@link CliContext.getMultipleModels} → `POST /model/<modelType>/get` with `{ keys }`, automatically chunked into batches of 50
 *
 * When provided by the runner, {@link CliContext.modelManifest} carries the generated
 * `CliModelManifest` so commands can resolve `prefix/id` keys to a `modelType`.
 */
export interface CliContext {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  readonly callModel: <TParams = unknown, TResult = unknown>(params: OnCallTypedModelParams<TParams>) => Promise<TResult>;
  readonly getModel: <TResult = unknown>(modelType: string, key: string) => Promise<GetModelOverHttpResult<TResult>>;
  readonly getMultipleModels: <TResult = unknown>(modelType: string, keys: ReadonlyArray<string>) => Promise<GetMultipleModelsOverHttpResult<TResult>>;
  readonly modelManifest?: CliModelManifest;
  /**
   * Opens (once per invocation) a direct Firestore connection as the authenticated user and returns
   * the `FirestoreContext` an app's `make<App>FirestoreCollections(context)` factory consumes — the
   * same object the Angular app builds, so the same queries run through the same security rules.
   *
   * Lazy on purpose: the handshake costs an HTTP round-trip plus a sign-in, and the auth middleware
   * builds a context on EVERY invocation, including ones that never touch Firestore.
   *
   * OPTIONAL so that a hand-built test context (see `createPassthroughAuthMiddleware`) stays valid.
   * Calling it throws when the env carries no Firebase client config — there is no fallback to the
   * HTTP model API by design.
   */
  readonly getFirestoreContext?: () => Promise<FirestoreContext>;
  /**
   * The full session behind {@link CliContext.getFirestoreContext} — the signed-in `Auth`, the raw
   * `Firestore`, and the minted credential envelope. Memoized alongside it, so calling both opens one
   * session.
   */
  readonly getFirestoreSession?: () => Promise<CliFirestoreSessionContext>;
}

/**
 * Returns the context's {@link CliFirestoreSessionContext} thunk result, or throws a {@link CliError}
 * when the context has none.
 *
 * {@link CliContext.getFirestoreSession} is optional so a hand-built test context stays valid, which
 * would otherwise leave every consumer action writing the same guard. Every context built by
 * {@link createCliContext} does provide it, so reaching this error in practice means the action ran
 * against a context that was assembled by hand.
 *
 * @param context - The live CLI context.
 * @returns The opened (and memoized) direct-Firestore session.
 * @throws {CliError} When the context does not support direct-Firestore sessions.
 */
export async function requireCliFirestoreSession(context: CliContext): Promise<CliFirestoreSessionContext> {
  const getFirestoreSession = context.getFirestoreSession;

  if (!getFirestoreSession) {
    throw new CliError({
      message: 'This CLI context does not support direct-Firestore sessions.',
      code: 'INVALID_ARGUMENT',
      suggestion: 'Use a context built by `createCliContext` (the auth middleware does this automatically).'
    });
  }

  return getFirestoreSession();
}

/**
 * Returns the client `FirestoreContext` for the current invocation, opening the direct-Firestore
 * session on first use.
 *
 * The returned context is the exact analogue of the server's, so an app's
 * `make<App>FirestoreCollections(context)` accepts it unchanged.
 *
 * @param context - The live CLI context.
 * @returns The client `FirestoreContext` an app's collections factory consumes.
 * @throws {CliError} When the context does not support direct-Firestore sessions.
 */
export async function requireCliFirestoreContext(context: CliContext): Promise<FirestoreContext> {
  return (await requireCliFirestoreSession(context)).firestoreContext;
}

/**
 * Module-level slot holding the {@link CliContext} for the current invocation.
 *
 * Stored here instead of on argv so that yargs strict-mode does not flag it as an unknown argument.
 */
const _cliContextSlot = createContextSlot<CliContext>({
  notInitializedMessage: 'CLI context not initialized — auth middleware must run before this command.'
});

export const setCliContext = _cliContextSlot.set;

export const getCliContext = _cliContextSlot.get;

/**
 * Returns the current {@link CliContext} or throws — for use in command handlers that require auth.
 */
export const requireCliContext = _cliContextSlot.require;

export interface CreateCliContextInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  /**
   * Optional generated model manifest. When supplied, surfaced on the context so commands
   * (e.g. `get <key>`) can resolve `prefix/id` keys to a `modelType` via `decodeFirestoreModelKey`.
   */
  readonly modelManifest?: CliModelManifest;
}

/**
 * Builds a {@link CliContext} for the current invocation.
 *
 * Bundles the env config and access token alongside helpers that POST/GET against
 * `<env.apiBaseUrl>/model/*` with the cached Bearer token.
 *
 * @param input - The context inputs.
 * @param input.cliName - The CLI's binary name.
 * @param input.envName - The active env name.
 * @param input.env - The resolved {@link CliEnvConfig} for the active env.
 * @param input.accessToken - The Bearer access token to include on outgoing API calls.
 * @param input.modelManifest - Optional generated {@link CliModelManifest} for key→modelType resolution.
 * @returns The constructed {@link CliContext}.
 * @__NO_SIDE_EFFECTS__
 */
export function createCliContext(input: CreateCliContextInput): CliContext {
  const apiBaseUrl = input.env.apiBaseUrl;
  const accessToken = input.accessToken;

  // memoized thunk — keeps this factory synchronous and side-effect-free while paying the session
  // cost only for commands that actually reach for Firestore
  let firestoreSession: Maybe<Promise<CliFirestoreSessionContext>>;

  function getFirestoreSession(): Promise<CliFirestoreSessionContext> {
    if (firestoreSession == null) {
      firestoreSession = createCliFirestoreSessionContext({
        cliName: input.cliName,
        envName: input.envName,
        env: input.env,
        accessToken
      }).catch((e) => {
        // drop the memo so a caller that handles the failure can retry rather than replaying it
        firestoreSession = undefined;
        throw e;
      });
    }

    return firestoreSession;
  }

  return {
    cliName: input.cliName,
    envName: input.envName,
    env: input.env,
    accessToken,
    modelManifest: input.modelManifest,
    callModel: <TParams = unknown, TResult = unknown>(params: OnCallTypedModelParams<TParams>) =>
      callModelOverHttp<TParams, TResult>({
        apiBaseUrl,
        accessToken,
        params
      }),
    getModel: <TResult = unknown>(modelType: string, key: string) =>
      getModelOverHttp<TResult>({
        apiBaseUrl,
        accessToken,
        modelType,
        key
      }),
    getMultipleModels: <TResult = unknown>(modelType: string, keys: ReadonlyArray<string>) =>
      getMultipleModelsOverHttpChunked<TResult>({
        apiBaseUrl,
        accessToken,
        modelType,
        keys
      }),
    getFirestoreSession,
    getFirestoreContext: () => getFirestoreSession().then((x) => x.firestoreContext)
  };
}
