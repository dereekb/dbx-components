import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type CliEnvConfig } from '../config/env';
import { callModelOverHttp, getModelOverHttp, getMultipleModelsOverHttp, type GetModelOverHttpResult, type GetMultipleModelsOverHttpResult } from '../api/call-model.client';
import { type CliModelManifest } from '../manifest/types';
import { createContextSlot } from '../util/context.slot';

/**
 * The CLI context attached to argv by the auth middleware.
 *
 * Holds the active env, the current access token, and helpers that perform HTTP calls against
 * `<env.apiBaseUrl>/model/*`:
 *  - {@link CliContext.callModel} → `POST /model/call` (typed model dispatch)
 *  - {@link CliContext.getModel} → `GET /model/<modelType>/get?key=<key>`
 *  - {@link CliContext.getMultipleModels} → `POST /model/<modelType>/get` with `{ keys }`
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
      getMultipleModelsOverHttp<TResult>({
        apiBaseUrl,
        accessToken,
        modelType,
        keys
      })
  };
}
