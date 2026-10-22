import { type Maybe } from '@dereekb/util';
import { type TrelloContext } from './trello.factory';
import { type TrelloMember } from './trello.api.member.type';

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
  return (input) => context.fetchJson(`/members/${input.memberId}${input.fields ? `?fields=${input.fields}` : ''}`, 'GET');
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
