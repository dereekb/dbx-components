import { type Maybe } from '@dereekb/util';
import { type ZohoDateTimeString } from '../zoho.type';
import { type ZohoDeskTicketId, type ZohoDeskContactId, type ZohoDeskProductId, type ZohoDeskDepartmentId, type ZohoDeskAgentId, type ZohoDeskTeamId, type ZohoDeskAccountId, type ZohoDeskContractId } from './desk';

// MARK: Ticket Status
/**
 * High-level ticket status category in Zoho Desk.
 */
export type ZohoDeskTicketStatusType = 'Open' | 'Closed' | 'On Hold';

/**
 * Ticket priority level in Zoho Desk.
 *
 * Known values include Low, Medium, High, and Urgent. Custom priorities may also be defined.
 */
export type ZohoDeskTicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | string;

/**
 * Communication channel through which a Zoho Desk ticket was created.
 *
 * Known values include Phone, Email, Social, Web, Chat, and Forums. Custom channels may also be present.
 */
export type ZohoDeskTicketChannel = 'Phone' | 'Email' | 'Social' | 'Web' | 'Chat' | 'Forums' | string;

// MARK: Ticket Sort / Include
/**
 * Fields by which Zoho Desk ticket lists can be sorted.
 */
export type ZohoDeskTicketSortBy = 'ticketNumber' | 'modifiedTime' | 'customerResponseTime' | 'recentThread' | 'responseDueDate' | 'dueDate' | 'createdTime';

/**
 * Related entities that can be expanded inline when fetching Zoho Desk tickets via the `include` query parameter.
 */
export type ZohoDeskTicketInclude = 'isRead' | 'departments' | 'team' | 'assignee' | 'contacts' | 'products';

// MARK: Ticket Source
/**
 * Describes the originating source application or service for a Zoho Desk ticket.
 */
export interface ZohoDeskTicketSource {
  readonly appName?: Maybe<string>;
  readonly extId?: Maybe<string>;
  readonly type?: Maybe<string>;
  readonly permalink?: Maybe<string>;
  readonly appPhotoURL?: Maybe<string>;
}

// MARK: Ticket
/**
 * A support ticket in Zoho Desk.
 *
 * Contains the full set of fields returned by the Zoho Desk Tickets API.
 */
export interface ZohoDeskTicket {
  readonly id: ZohoDeskTicketId;
  readonly ticketNumber: string;
  readonly subject: string;
  readonly description?: Maybe<string>;
  readonly status: string;
  readonly statusType: ZohoDeskTicketStatusType;
  readonly priority?: Maybe<ZohoDeskTicketPriority>;
  readonly classification?: Maybe<string>;
  readonly category?: Maybe<string>;
  readonly subCategory?: Maybe<string>;
  readonly channel?: Maybe<ZohoDeskTicketChannel>;
  readonly channelCode?: Maybe<string>;
  readonly email?: Maybe<string>;
  readonly phone?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
  readonly sentiment?: Maybe<string>;
  readonly resolution?: Maybe<string>;

  // Related entity IDs
  readonly departmentId?: Maybe<ZohoDeskDepartmentId>;
  readonly contactId?: Maybe<ZohoDeskContactId>;
  readonly productId?: Maybe<ZohoDeskProductId>;
  readonly accountId?: Maybe<ZohoDeskAccountId>;
  readonly assigneeId?: Maybe<ZohoDeskAgentId>;
  readonly teamId?: Maybe<ZohoDeskTeamId>;
  readonly contractId?: Maybe<ZohoDeskContractId>;

  // Timestamps
  readonly dueDate?: Maybe<ZohoDateTimeString>;
  readonly responseDueDate?: Maybe<ZohoDateTimeString>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly modifiedTime?: Maybe<ZohoDateTimeString>;
  readonly closedTime?: Maybe<ZohoDateTimeString>;
  readonly onholdTime?: Maybe<ZohoDateTimeString>;
  readonly customerResponseTime?: Maybe<ZohoDateTimeString>;

  // Counts
  readonly threadCount?: Maybe<number>;
  readonly commentCount?: Maybe<number>;
  readonly taskCount?: Maybe<number>;
  readonly sharedCount?: Maybe<number>;
  readonly approvalCount?: Maybe<number>;
  readonly followerCount?: Maybe<number>;
  readonly tagCount?: Maybe<number>;
  readonly attachmentCount?: Maybe<number>;
  readonly timeEntryCount?: Maybe<number>;

  // Boolean flags
  readonly isTrashed?: Maybe<boolean>;
  readonly isResponseOverdue?: Maybe<boolean>;
  readonly isSpam?: Maybe<boolean>;
  readonly isRead?: Maybe<boolean>;
  readonly isDeleted?: Maybe<boolean>;
  readonly isFollowing?: Maybe<boolean>;

  // Nested objects
  readonly source?: Maybe<ZohoDeskTicketSource>;
  readonly secondaryContacts?: Maybe<string[]>;
  readonly createdBy?: Maybe<string>;
  readonly modifiedBy?: Maybe<string>;

  // Include expansions (populated when `include` query param is used)
  readonly product?: Maybe<Record<string, unknown>>;
  readonly contact?: Maybe<Record<string, unknown>>;
  readonly team?: Maybe<Record<string, unknown>>;
  readonly assignee?: Maybe<Record<string, unknown>>;
  readonly department?: Maybe<Record<string, unknown>>;

  // Custom fields (arbitrary keys)
  readonly cf?: Maybe<Record<string, unknown>>;
}

// MARK: Ticket Metrics
/**
 * Performance and SLA metrics for a single Zoho Desk ticket, returned by the ticket metrics endpoint.
 */
export interface ZohoDeskTicketMetrics {
  readonly reopenCount?: Maybe<number>;
  readonly firstResponseTime?: Maybe<string>;
  readonly averageResponseTime?: Maybe<string>;
  readonly resolutionTime?: Maybe<string>;
  readonly happinessRating?: Maybe<string>;
  readonly assigneeChanges?: Maybe<number>;
  readonly threadCount?: Maybe<number>;
  readonly responseCount?: Maybe<number>;
}

// MARK: Agent Ticket Count
/**
 * Ticket count data for a single agent, returned by the agents ticket count endpoint.
 */
export interface ZohoDeskAgentTicketCount {
  readonly agentId: ZohoDeskAgentId;
  readonly count: number;
}
