import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type CliEnvConfig } from '../config/env';
import { callModelOverHttp } from '../api/call-model.client';
import { createContextSlot } from '../util/context.slot';

/**
 * The CLI context attached to argv by the auth middleware.
 *
 * Holds the active env, the current access token, and a `callModel` helper that performs
 * the HTTP call against `<env.apiBaseUrl>/model/call`.
 */
export interface CliContext {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  readonly callModel: <TParams = unknown, TResult = unknown>(params: OnCallTypedModelParams<TParams>) => Promise<TResult>;
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
}

export function createCliContext(input: CreateCliContextInput): CliContext {
  return {
    cliName: input.cliName,
    envName: input.envName,
    env: input.env,
    accessToken: input.accessToken,
    callModel: <TParams = unknown, TResult = unknown>(params: OnCallTypedModelParams<TParams>) =>
      callModelOverHttp<TParams, TResult>({
        apiBaseUrl: input.env.apiBaseUrl,
        accessToken: input.accessToken,
        params
      })
  };
}
