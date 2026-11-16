import { type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloMember } from './trello.api.member.type';
import { type TrelloBoard } from './trello.api.board.type';

export interface GetMemberInput {
  /**
   * Member id, username, or the literal `me` (the authenticated user).
   */
  readonly memberId: string;
  /**
   * Optional comma-separated member fields to return, e.g. `id,username,fullName`. Trello returns its
   * default field set when omitted.
   */
  readonly fields?: Maybe<string>;
}

export type GetMemberFunction = (input: GetMemberInput) => Promise<TrelloMember>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a member by id (or `me`).
 */
export function getMember(context: TrelloContext): GetMemberFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ fields: input.fields });
    return context.fetchJson(`/members/${encodeURIComponent(input.memberId)}${queryString.size > 0 ? `?${queryString}` : ''}`, 'GET');
  };
}

export type GetMeInput = Omit<GetMemberInput, 'memberId'>;

export type GetMeFunction = (input?: Maybe<GetMeInput>) => Promise<TrelloMember>;

/**
 * Convenience wrapper around `getMember({ memberId: 'me' })`.
 *
 * @param context - The Trello API context.
 * @returns Retrieves the authenticated user.
 */
export function getMe(context: TrelloContext): GetMeFunction {
  const getMemberFn = getMember(context);
  return (input) => getMemberFn({ ...input, memberId: 'me' });
}

/**
 * Which of a member's boards {@link listMemberBoards} returns.
 */
export type TrelloMemberBoardsFilter = 'all' | 'closed' | 'members' | 'open' | 'organization' | 'public' | 'starred';

export interface ListMemberBoardsInput {
  /**
   * Member id, username, or the literal `me` (the authenticated user). Defaults to `me`.
   */
  readonly memberId?: Maybe<string>;
  /**
   * Which boards to return. Defaults to `all` server-side.
   */
  readonly filter?: Maybe<TrelloMemberBoardsFilter>;
  /**
   * Comma-separated list of board fields to return, or `all`.
   */
  readonly fields?: Maybe<string>;
}

export type ListMemberBoardsFunction = (input?: Maybe<ListMemberBoardsInput>) => Promise<ReadonlyArray<TrelloBoard>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-boards-get.
 *
 * @param context - The Trello API context.
 * @returns Lists the boards a member belongs to (the authenticated user's by default).
 */
export function listMemberBoards(context: TrelloContext): ListMemberBoardsFunction {
  return (input) => {
    const { memberId, ...query } = input ?? {};
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/members/${encodeURIComponent(memberId ?? 'me')}/boards?${queryString}`, 'GET');
  };
}
