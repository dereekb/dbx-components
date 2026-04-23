import { type Maybe } from '@dereekb/util';
import { type ZohoDateTimeString } from '../zoho.type';
import { type ZohoDeskDepartmentId } from './desk';

// MARK: Department
/**
 * Availability status of the live chat feature for a Zoho Desk department.
 */
export type ZohoDeskDepartmentChatStatus = 'AVAILABLE' | 'DISABLED' | 'NOT_CREATED';

/**
 * A department in Zoho Desk.
 *
 * Departments are organizational units that group tickets by functional area.
 */
export interface ZohoDeskDepartment {
  readonly id: ZohoDeskDepartmentId;
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly isEnabled?: Maybe<boolean>;
  readonly isDefault?: Maybe<boolean>;
  readonly hasLogo?: Maybe<boolean>;
  readonly chatStatus?: Maybe<ZohoDeskDepartmentChatStatus>;
  readonly isVisibleInCustomerPortal?: Maybe<boolean>;
  readonly nameInCustomerPortal?: Maybe<string>;
  readonly isAssignToTeamEnabled?: Maybe<boolean>;
  readonly creatorId?: Maybe<string>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly associatedAgentIds?: Maybe<string[]>;
}
