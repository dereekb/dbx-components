import { type Maybe } from '@dereekb/util';
import { type ZohoDeskAgentId } from './desk';

// MARK: Agent Types
/**
 * Agent status in Zoho Desk.
 */
export type ZohoDeskAgentStatus = 'ACTIVE' | 'DISABLED';

/**
 * Agent role permission type in Zoho Desk.
 */
export type ZohoDeskAgentRolePermissionType = 'Light' | 'AgentPublic' | 'Custom' | 'AgentPersonal' | 'Admin' | (string & {});

/**
 * Related entities that can be expanded when fetching agents.
 */
export type ZohoDeskAgentInclude = 'associatedChatDepartments' | 'role' | 'profile' | 'associatedDepartments';

// MARK: Agent
/**
 * An agent (support staff member) in Zoho Desk.
 */
export interface ZohoDeskAgent {
  readonly id: ZohoDeskAgentId;
  readonly name?: Maybe<string>;
  readonly firstName?: Maybe<string>;
  readonly lastName?: Maybe<string>;
  readonly emailId?: Maybe<string>;
  readonly phone?: Maybe<string>;
  readonly mobile?: Maybe<string>;
  readonly extn?: Maybe<string>;
  readonly photoURL?: Maybe<string>;
  readonly timeZone?: Maybe<string>;
  readonly langCode?: Maybe<string>;
  readonly countryCode?: Maybe<string>;
  readonly aboutInfo?: Maybe<string>;
  readonly channelExpert?: Maybe<string>;
  readonly roleId?: Maybe<string>;
  readonly profileId?: Maybe<string>;
  readonly zuid?: Maybe<string>;
  readonly isConfirmed?: Maybe<boolean>;
  readonly status?: Maybe<ZohoDeskAgentStatus>;
  readonly rolePermissionType?: Maybe<ZohoDeskAgentRolePermissionType>;
  readonly associatedDepartmentIds?: Maybe<string[]>;
  readonly associatedChatDepartmentIds?: Maybe<string[]>;

  // Include expansions
  readonly role?: Maybe<Record<string, unknown>>;
  readonly profile?: Maybe<Record<string, unknown>>;
  readonly associatedDepartments?: Maybe<Record<string, unknown>[]>;
  readonly associatedChatDepartments?: Maybe<Record<string, unknown>[]>;
}
