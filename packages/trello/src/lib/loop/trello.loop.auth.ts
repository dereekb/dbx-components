import { type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloMemberId } from '../trello.type';
import { type TrelloContextRef } from '../trello/trello.factory';
import { type TrelloMember } from '../trello/trello.api.member.type';
import { TrelloServerError } from '../trello.error.api';

/**
 * Default timeout for {@link probeTrelloAuth}.
 */
export const DEFAULT_TRELLO_AUTH_PROBE_TIMEOUT_MS = 10_000;

/**
 * Why {@link probeTrelloAuth} failed. `RATE_LIMITED` is a 429: the credentials may be fine, so a caller can wait and
 * probe again rather than treat the token as bad.
 */
export type TrelloAuthProbeErrorCode = 'TOKEN_REJECTED' | 'SCOPE_DENIED' | 'RATE_LIMITED' | 'TIMEOUT' | 'API_ERROR' | 'NETWORK_ERROR';

/**
 * The result of {@link probeTrelloAuth}.
 */
export type TrelloAuthProbeResult =
  | { readonly ok: true; readonly member: { readonly id: TrelloMemberId; readonly username: string; readonly fullName: string } }
  | {
      readonly ok: false;
      readonly code: TrelloAuthProbeErrorCode;
      /**
       * The HTTP status, when Trello answered.
       */
      readonly status?: Maybe<number>;
      readonly message: string;
    };

/**
 * Input for {@link probeTrelloAuth}.
 */
export interface ProbeTrelloAuthInput extends TrelloContextRef {
  /**
   * How long to wait for Trello, including any rate-limiter wait, before giving up with `TIMEOUT` and aborting the
   * request. Defaults to {@link DEFAULT_TRELLO_AUTH_PROBE_TIMEOUT_MS}. The context's own 20s request timeout still
   * applies, so a longer value does not extend it.
   */
  readonly timeoutMs?: Maybe<number>;
}

/**
 * Checks that the context's credentials work by reading `/members/me`. Goes through the context, so the credentials
 * travel in the `Authorization` header rather than the URL, and the configured api url, rate limiter and token
 * provider all apply. Never throws.
 *
 * On timeout the in-flight request is aborted rather than left to run out the context's request timeout. A 429 is
 * reported as `RATE_LIMITED`; a context with its rate limiter on retries a 429 once first, within the same timeout.
 *
 * @param input - The Trello context and an optional timeout.
 * @returns The authenticated member, or why the probe failed.
 */
export async function probeTrelloAuth(input: ProbeTrelloAuthInput): Promise<TrelloAuthProbeResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TRELLO_AUTH_PROBE_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: Maybe<ReturnType<typeof setTimeout>>;
  const timeout = new Promise<TrelloAuthProbeResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, code: 'TIMEOUT', message: `Trello did not answer /members/me within ${timeoutMs}ms.` });
      controller.abort();
    }, timeoutMs);
  });

  const query = makeUrlSearchParams({ fields: 'id,username,fullName' });
  const probe = input.trelloContext.fetchJson<TrelloMember>(`/members/me?${query}`, { method: 'GET', signal: controller.signal }).then(
    (member): TrelloAuthProbeResult => ({ ok: true, member: { id: member.id, username: member.username, fullName: member.fullName } }),
    (error: unknown): TrelloAuthProbeResult => trelloAuthProbeFailure(error)
  );

  const result = await Promise.race([probe, timeout]);
  clearTimeout(timer ?? undefined);
  return result;
}

function trelloAuthProbeFailure(error: unknown): TrelloAuthProbeResult {
  const status = error instanceof TrelloServerError ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  let code: TrelloAuthProbeErrorCode;

  if (status === 401) {
    code = 'TOKEN_REJECTED';
  } else if (status === 403) {
    code = 'SCOPE_DENIED';
  } else if (status === 429) {
    code = 'RATE_LIMITED';
  } else if (status == null) {
    code = 'NETWORK_ERROR';
  } else {
    code = 'API_ERROR';
  }

  return { ok: false, code, status, message };
}
