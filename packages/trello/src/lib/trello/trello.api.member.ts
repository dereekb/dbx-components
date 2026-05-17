import { type TrelloContext } from './trello.factory';
import { type TrelloMember } from './trello.api.member.type';

export interface GetMemberInput {
  /**
   * Member id, username, or the literal `me` (the authenticated user).
   */
  readonly memberId: string;
}

export type GetMemberFunction = (input: GetMemberInput) => Promise<TrelloMember>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-get
 *
 * @param context The Trello API context.
 * @returns A function that retrieves a member by id (or `me`).
 */
export function getMember(context: TrelloContext): GetMemberFunction {
  return (input) => context.fetchJson(`/members/${input.memberId}`, 'GET');
}

export type GetMeFunction = () => Promise<TrelloMember>;

/**
 * Convenience wrapper around `getMember({ memberId: 'me' })`.
 *
 * @param context The Trello API context.
 * @returns A function that retrieves the authenticated user.
 */
export function getMe(context: TrelloContext): GetMeFunction {
  return () => context.fetchJson(`/members/me`, 'GET');
}
