import { type CliDownloadFailure, type CliDownloadFailureClassifier, type CliDownloadFailureClassifyFunction, CliDownloadTaskFailedError, composeCliDownloadFailureClassifiers, defaultCliDownloadFailureClassifier } from '@dereekb/dbx-cli';
import { MicrosoftGraphError, isMicrosoftGraphNotFoundError, isMicrosoftGraphServiceError, microsoftGraphRetryAfter } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { msGraphCliErrorOutput } from './output';

/**
 * Classifies a {@link MicrosoftGraphError} for the dbx-cli download engine by its status.
 *
 * - 401: `fatal` (the token was rejected; {@link msGraphCliReauthOnce} retries once before it gets here).
 * - 429: `throttled`, with the `Retry-After` wait.
 * - 5xx / `UnknownError`: `transient`, with the `Retry-After` wait.
 * - 403 (`malwareDetected` included), 404 / `itemNotFound` and anything else: `item`.
 *
 * The failure's `code` is the CLI envelope's (`SCOPE_DENIED`, `NOT_FOUND`, `RATE_LIMITED`, …), so failure
 * tallies use the same vocabulary as a failed command. Other errors return undefined so the next classifier answers.
 *
 * @param error - The thrown value.
 * @returns The failure, or undefined when the error is not a Graph error.
 */
export const msGraphCliDownloadFailureClassifier: CliDownloadFailureClassifier = (error: unknown) => {
  let result: Maybe<CliDownloadFailure>;

  if (error instanceof MicrosoftGraphError) {
    const code = msGraphCliErrorOutput(error)?.code ?? 'API_ERROR';

    if (error.status === 401) {
      result = { kind: 'fatal', code };
    } else if (error.status === 429) {
      result = { kind: 'throttled', code, retryAfter: microsoftGraphRetryAfter(error) };
    } else if (error.status === 403 || isMicrosoftGraphNotFoundError(error)) {
      result = { kind: 'item', code };
    } else if (isMicrosoftGraphServiceError(error)) {
      result = { kind: 'transient', code, retryAfter: microsoftGraphRetryAfter(error) };
    } else {
      result = { kind: 'item', code };
    }
  }

  return result;
};

/**
 * The classifier msgraph-cli's bulk downloads run with: Graph errors by {@link msGraphCliDownloadFailureClassifier},
 * then the dbx-cli default (stalls, short bodies, non-Graph HTTP errors, network and disk errors).
 */
export const msGraphCliDownloadFailureClassify: CliDownloadFailureClassifyFunction = composeCliDownloadFailureClassifiers(msGraphCliDownloadFailureClassifier, defaultCliDownloadFailureClassifier);

/**
 * Returns whether an error is a Graph 401, also when a bulk-download task wrapped it.
 *
 * @param error - The thrown value.
 * @returns True for a rejected token.
 */
export function isMsGraphCliTokenRejectedError(error: unknown): boolean {
  const unwrapped = error instanceof CliDownloadTaskFailedError ? error.cause : error;
  return unwrapped instanceof MicrosoftGraphError && unwrapped.status === 401;
}

/**
 * What {@link msGraphCliReauthOnce} needs from a token source.
 */
export interface MsGraphCliReauthTokenSource {
  /**
   * Forgets the cached token, so the next request mints a new one.
   */
  resetToken(): Promise<void>;
}

/**
 * Runs an operation, retrying it once with a new token.
 */
export type MsGraphCliReauthOnceFunction = <T>(op: () => Promise<T>) => Promise<T>;

/**
 * Returns a wrapper that keeps a long run alive when its token is revoked or expires early: the first Graph
 * 401 of the run resets the token source's cached token and retries the operation once. A later 401, or a
 * 401 on the retry, is rethrown, which the download engine treats as fatal (`TOKEN_REJECTED`).
 *
 * Operations already running when the token was reset share that one reset and each retry once; an operation
 * that started after it gets no retry.
 *
 * @param tokenSource - The run's token source.
 * @returns The wrapper; share one per run.
 */
export function msGraphCliReauthOnce(tokenSource: MsGraphCliReauthTokenSource): MsGraphCliReauthOnceFunction {
  let reset: Maybe<Promise<void>>;
  let resetDone = false;

  return async <T>(op: () => Promise<T>): Promise<T> => {
    // an operation that started with the new token gets no second chance
    const startedAfterReset = resetDone;
    let result: T;

    try {
      result = await op();
    } catch (error) {
      if (startedAfterReset || !isMsGraphCliTokenRejectedError(error)) {
        throw error;
      }

      reset ??= tokenSource.resetToken().finally(() => {
        resetDone = true;
      });
      await reset;
      result = await op();
    }

    return result;
  };
}
