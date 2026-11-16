import { makeUrlSearchParams } from '@dereekb/util/fetch';

/**
 * The value Trello reads as "clear this field" on a write.
 *
 * Trello ignores a JSON `null` in a request body (`{ "due": null }` leaves a card's due date as it is). It clears a field
 * only when it receives the string `null` as a query or form value (`?due=null`).
 */
export const TRELLO_CLEAR_FIELD_VALUE = 'null';

/**
 * Input to {@link makeTrelloWriteRequest}.
 */
export interface MakeTrelloWriteRequestInput {
  /**
   * The api path, without a query string, e.g. `/cards/<id>`.
   */
  readonly path: string;
  /**
   * The write's params. A `null` value clears that field on Trello; an `undefined` value is left out.
   */
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * A Trello write split between the url and the JSON body.
 */
export interface TrelloWriteRequest {
  /**
   * The path, with each cleared field appended as `<field>=null`.
   */
  readonly path: string;
  /**
   * The fields to set, sent as the JSON body. Undefined when every given field was cleared, so the request carries no body.
   */
  readonly body?: Record<string, unknown>;
}

/**
 * Builds a write Trello honors: each `null` param moves to the query string as the string `null`, and every other defined
 * param stays in the JSON body unchanged.
 *
 * @param input - The path and the params.
 * @returns The path carrying the cleared fields, and the JSON body.
 */
export function makeTrelloWriteRequest(input: MakeTrelloWriteRequestInput): TrelloWriteRequest {
  const body: Record<string, unknown> = {};
  const cleared: Record<string, string> = {};

  for (const [key, value] of Object.entries(input.params)) {
    if (value === null) {
      cleared[key] = TRELLO_CLEAR_FIELD_VALUE;
    } else if (value !== undefined) {
      body[key] = value;
    }
  }

  const queryString = makeUrlSearchParams(cleared).toString();
  return { path: queryString ? `${input.path}?${queryString}` : input.path, body: Object.keys(body).length > 0 ? body : undefined };
}
