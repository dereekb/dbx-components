import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliEnvConfig } from '../config/env';
import { callModelOverHttp } from '../api/call-model.client';

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
let _currentCliContext: Maybe<CliContext>;

export function setCliContext(context: Maybe<CliContext>): void {
  _currentCliContext = context;
}

export function getCliContext(): Maybe<CliContext> {
  return _currentCliContext;
}

/**
 * Returns the current {@link CliContext} or throws — for use in command handlers that require auth.
 */
export function requireCliContext(): CliContext {
  if (!_currentCliContext) {
    throw new Error('CLI context not initialized — auth middleware must run before this command.');
  }

  return _currentCliContext;
}

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
