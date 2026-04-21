import { type Maybe } from '@dereekb/util';
import { type ZohoDateTimeString } from '../zoho.type';
import { type ZohoDeskContactId, type ZohoDeskAccountId } from './desk';

// MARK: Contact Sort / Include
/**
 * Fields by which Zoho Desk contact lists can be sorted.
 */
export type ZohoDeskContactSortBy = 'firstName' | 'lastName' | 'modifiedTime' | 'phone' | 'createdTime' | 'email' | 'account';

/**
 * Related entities that can be expanded inline when fetching Zoho Desk contacts via the `include` query parameter.
 */
export type ZohoDeskContactInclude = 'owner' | 'accounts';

// MARK: Contact
/**
 * A contact in Zoho Desk.
 *
 * Contacts represent end users or customers who submit support tickets.
 */
export interface ZohoDeskContact {
  readonly id: ZohoDeskContactId;
  readonly firstName?: Maybe<string>;
  readonly lastName: string;
  readonly email?: Maybe<string>;
  readonly secondaryEmail?: Maybe<string>;
  readonly phone?: Maybe<string>;
  readonly mobile?: Maybe<string>;
  readonly twitter?: Maybe<string>;
  readonly facebook?: Maybe<string>;
  readonly type?: Maybe<string>;
  readonly title?: Maybe<string>;
  readonly description?: Maybe<string>;
  readonly photoURL?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
  readonly accountId?: Maybe<ZohoDeskAccountId>;
  readonly ownerId?: Maybe<string>;

  // Address fields
  readonly country?: Maybe<string>;
  readonly state?: Maybe<string>;
  readonly city?: Maybe<string>;
  readonly street?: Maybe<string>;
  readonly zip?: Maybe<string>;

  // Boolean flags
  readonly isDeleted?: Maybe<boolean>;
  readonly isTrashed?: Maybe<boolean>;
  readonly isEndUser?: Maybe<boolean>;
  readonly isFollowing?: Maybe<boolean>;
  readonly isAnonymous?: Maybe<boolean>;
  readonly isSpam?: Maybe<boolean>;

  // Timestamps
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly modifiedTime?: Maybe<ZohoDateTimeString>;

  // Include expansions (populated when `include` query param is used)
  readonly owner?: Maybe<Record<string, unknown>>;
  readonly account?: Maybe<Record<string, unknown>>;

  // Custom fields (arbitrary keys)
  readonly cf?: Maybe<Record<string, unknown>>;
}
