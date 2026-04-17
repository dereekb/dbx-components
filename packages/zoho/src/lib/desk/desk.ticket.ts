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

// MARK: Ticket Tag
/**
 * A tag associated with a Zoho Desk ticket.
 */
export interface ZohoDeskTicketTag {
  readonly id: string;
  readonly name: string;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly ticketCount?: Maybe<number>;
}

// MARK: Ticket Follower
/**
 * A follower of a Zoho Desk ticket (typically an agent).
 */
export interface ZohoDeskTicketFollower {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly email?: Maybe<string>;
  readonly photoURL?: Maybe<string>;
}

// MARK: Ticket Attachment
/**
 * Fields by which Zoho Desk ticket attachment lists can be sorted.
 */
export type ZohoDeskAttachmentSortBy = 'createdTime';

/**
 * Related entities that can be expanded when fetching ticket attachments.
 */
export type ZohoDeskAttachmentInclude = 'creator';

/**
 * A file attachment on a Zoho Desk ticket.
 */
export interface ZohoDeskTicketAttachment {
  readonly id: string;
  readonly name: string;
  readonly size?: Maybe<string>;
  readonly href?: Maybe<string>;
  readonly isPublic?: Maybe<boolean>;
  readonly creatorId?: Maybe<string>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly creator?: Maybe<Record<string, unknown>>;
}

// MARK: Ticket Comment
/**
 * Content type of a Zoho Desk ticket comment.
 */
export type ZohoDeskCommentContentType = 'plainText' | 'html';

/**
 * Fields by which Zoho Desk ticket comment lists can be sorted.
 */
export type ZohoDeskCommentSortBy = 'commentedTime';

/**
 * Related entities that can be expanded when fetching ticket comments.
 */
export type ZohoDeskCommentInclude = 'mentions';

/**
 * A comment on a Zoho Desk ticket.
 */
export interface ZohoDeskTicketComment {
  readonly id: string;
  readonly content: string;
  readonly encodedContent?: Maybe<string>;
  readonly contentType?: Maybe<ZohoDeskCommentContentType>;
  readonly commenterId?: Maybe<string>;
  readonly commentedTime?: Maybe<ZohoDateTimeString>;
  readonly modifiedTime?: Maybe<ZohoDateTimeString>;
  readonly isPublic?: Maybe<boolean>;
  readonly attachmentIds?: Maybe<string[]>;
  readonly commenter?: Maybe<Record<string, unknown>>;
  readonly mentions?: Maybe<Record<string, unknown>[]>;
}

// MARK: Ticket Time Entry
/**
 * A time entry recorded against a Zoho Desk ticket.
 */
export interface ZohoDeskTicketTimeEntry {
  readonly id: string;
  readonly ownerId?: Maybe<string>;
  readonly billingType?: Maybe<string>;
  readonly description?: Maybe<string>;
  readonly executedTime?: Maybe<ZohoDateTimeString>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly hh?: Maybe<string>;
  readonly mm?: Maybe<string>;
  readonly requestedBy?: Maybe<string>;
  readonly agentCostPerHour?: Maybe<string>;
  readonly additionalCost?: Maybe<string>;
  readonly totalCost?: Maybe<string>;
}

// MARK: Ticket Timer
/**
 * Timer state for a Zoho Desk ticket.
 */
export interface ZohoDeskTicketTimer {
  readonly isBillable?: Maybe<boolean>;
  readonly timerAction?: Maybe<string>;
  readonly startedTime?: Maybe<ZohoDateTimeString>;
}

// MARK: Ticket Thread
/**
 * Communication channel for a thread.
 */
export type ZohoDeskThreadChannel = 'EMAIL' | 'PHONE' | 'WEB' | 'CUSTOMERPORTAL' | 'FORUMS' | 'FACEBOOK' | 'TWITTER' | 'TWITTER_DM' | 'ONLINE_CHAT' | 'OFFLINE_CHAT' | 'FEEDBACK' | 'FEEDBACK_WIDGET' | string;

/**
 * Direction of a thread message relative to the support team.
 */
export type ZohoDeskThreadDirection = 'in' | 'out';

/**
 * Visibility of a thread to end users.
 */
export type ZohoDeskThreadVisibility = 'public' | 'private';

/**
 * Delivery status of a thread.
 */
export type ZohoDeskThreadStatus = 'SUCCESS' | 'FAILED' | 'DRAFT' | 'PENDING';

/**
 * Related entities that can be expanded when fetching threads.
 */
export type ZohoDeskThreadInclude = 'plainText';

/**
 * A conversation thread on a Zoho Desk ticket (email, reply, note, etc.).
 */
export interface ZohoDeskTicketThread {
  readonly id: string;
  readonly content?: Maybe<string>;
  readonly contentType?: Maybe<string>;
  readonly direction?: Maybe<ZohoDeskThreadDirection>;
  readonly channel?: Maybe<ZohoDeskThreadChannel>;
  readonly visibility?: Maybe<ZohoDeskThreadVisibility>;
  readonly status?: Maybe<ZohoDeskThreadStatus>;
  readonly summary?: Maybe<string>;
  readonly to?: Maybe<string>;
  readonly cc?: Maybe<string>;
  readonly bcc?: Maybe<string>;
  readonly fromEmailAddress?: Maybe<string>;
  readonly responderId?: Maybe<string>;
  readonly replyTo?: Maybe<string>;
  readonly fullContentURL?: Maybe<string>;
  readonly isDescriptionThread?: Maybe<boolean>;
  readonly isContentTruncated?: Maybe<boolean>;
  readonly canReply?: Maybe<boolean>;
  readonly isForward?: Maybe<boolean>;
  readonly hasAttach?: Maybe<boolean>;
  readonly attachmentCount?: Maybe<number>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly author?: Maybe<Record<string, unknown>>;
  readonly source?: Maybe<Record<string, unknown>>;
  readonly channelRelatedInfo?: Maybe<Record<string, unknown>>;
  readonly plainText?: Maybe<string>;
  readonly attachments?: Maybe<Record<string, unknown>[]>;
}

// MARK: Ticket Activity
/**
 * Type of activity associated with a ticket.
 */
export type ZohoDeskActivityType = 'Tasks' | 'Events' | 'Calls';

/**
 * Status of a ticket activity.
 */
export type ZohoDeskActivityStatus = 'Scheduled' | 'Completed' | 'Missed' | 'In Progress' | 'Canceled';

/**
 * Direction of a ticket activity.
 */
export type ZohoDeskActivityDirection = 'inbound' | 'outbound';

/**
 * Related entities that can be expanded when fetching activities.
 */
export type ZohoDeskActivityInclude = 'ticket' | 'contact' | 'assignee' | 'team';

/**
 * An activity (task, event, or call) associated with a Zoho Desk ticket.
 */
export interface ZohoDeskTicketActivity {
  readonly id: string;
  readonly activityType?: Maybe<ZohoDeskActivityType>;
  readonly status?: Maybe<ZohoDeskActivityStatus>;
  readonly direction?: Maybe<ZohoDeskActivityDirection>;
  readonly subject?: Maybe<string>;
  readonly description?: Maybe<string>;
  readonly category?: Maybe<string>;
  readonly priority?: Maybe<string>;
  readonly ticketId?: Maybe<ZohoDeskTicketId>;
  readonly contactId?: Maybe<ZohoDeskContactId>;
  readonly departmentId?: Maybe<ZohoDeskDepartmentId>;
  readonly creatorId?: Maybe<string>;
  readonly ownerId?: Maybe<string>;
  readonly dueDate?: Maybe<ZohoDateTimeString>;
  readonly startTime?: Maybe<ZohoDateTimeString>;
  readonly createdTime?: Maybe<ZohoDateTimeString>;
  readonly completedTime?: Maybe<ZohoDateTimeString>;
  readonly isCommented?: Maybe<boolean>;
  readonly webUrl?: Maybe<string>;

  // Include expansions
  readonly ticket?: Maybe<Record<string, unknown>>;
  readonly contact?: Maybe<Record<string, unknown>>;
  readonly assignee?: Maybe<Record<string, unknown>>;
  readonly team?: Maybe<Record<string, unknown>>;
}
