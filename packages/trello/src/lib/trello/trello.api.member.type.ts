import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloMemberId, type TrelloOrganizationId, type TrelloUsername } from '../trello.type';

/**
 * Trello member.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-get
 */
export interface TrelloMember {
  readonly id: TrelloMemberId;
  readonly username: TrelloUsername;
  readonly fullName: string;
  readonly initials: string;
  readonly avatarUrl: Maybe<string>;
  /**
   * Email is only returned for the requesting user, and only when the token has the `account` scope.
   */
  readonly email?: Maybe<EmailAddress>;
  readonly idBoards?: ReadonlyArray<TrelloBoardId>;
  readonly idOrganizations?: ReadonlyArray<TrelloOrganizationId>;
}
