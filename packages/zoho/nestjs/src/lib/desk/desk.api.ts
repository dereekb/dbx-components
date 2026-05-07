import { Inject, Injectable } from '@nestjs/common';
import {
  type ZohoDesk,
  type ZohoDeskContext,
  zohoDeskFactory,
  zohoDeskGetTickets,
  zohoDeskGetTicketById,
  zohoDeskSearchTickets,
  zohoDeskGetTicketsForContact,
  zohoDeskGetTicketsForProduct,
  zohoDeskGetTicketMetrics,
  zohoDeskGetAgentsTicketsCount,
  zohoDeskGetTicketsPageFactory,
  zohoDeskSearchTicketsPageFactory,
  zohoDeskGetDepartments,
  zohoDeskGetDepartmentById,
  zohoDeskGetContacts,
  zohoDeskGetContactById,
  zohoDeskGetContactsByIds,
  zohoDeskGetContactsPageFactory,
  zohoDeskGetTicketTags,
  zohoDeskAssociateTicketTags,
  zohoDeskDissociateTicketTag,
  zohoDeskSearchTags,
  zohoDeskGetAllTags,
  zohoDeskGetTicketFollowers,
  zohoDeskAddTicketFollowers,
  zohoDeskRemoveTicketFollowers,
  zohoDeskGetTicketAttachments,
  zohoDeskDeleteTicketAttachment,
  zohoDeskGetTicketComments,
  zohoDeskGetTicketCommentById,
  zohoDeskCreateTicketComment,
  zohoDeskDeleteTicketComment,
  zohoDeskGetTicketTimer,
  zohoDeskPerformTicketTimerAction,
  zohoDeskGetTicketTimeEntries,
  zohoDeskGetTicketTimeEntryById,
  zohoDeskGetTicketTimeEntrySummation,
  zohoDeskGetTicketThreads,
  zohoDeskGetTicketThreadById,
  zohoDeskGetTicketThreadsPageFactory,
  zohoDeskGetTicketActivities,
  zohoDeskGetTicketActivitiesPageFactory,
  zohoDeskGetAgents,
  zohoDeskGetAgentById,
  zohoDeskGetAgentsByIds,
  zohoDeskGetMyInfo,
  zohoDeskGetAgentsPageFactory
} from '@dereekb/zoho';
import { ZohoDeskServiceConfig } from './desk.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

/**
 * NestJS injectable service that wraps the Zoho Desk API.
 *
 * Provides convenient accessor getters for all Desk operations (tickets, departments, contacts),
 * each bound to the authenticated Desk context created during construction.
 */
@Injectable()
export class ZohoDeskApi {
  /**
   * Underlying Zoho Desk client instance, initialized from the injected config and accounts context.
   */
  readonly zohoDesk: ZohoDesk;

  /**
   * The authenticated Desk context used by all operation accessors.
   *
   * @returns the Desk context from the underlying client
   */
  get deskContext(): ZohoDeskContext {
    return this.zohoDesk.deskContext;
  }

  /**
   * Rate limiter shared across all Desk requests to respect Zoho API quotas.
   *
   * @returns the shared rate limiter instance
   */
  get zohoRateLimiter() {
    return this.zohoDesk.deskContext.zohoRateLimiter;
  }

  /**
   * Initializes the Desk client by combining the service config with the
   * accounts context for OAuth token management.
   *
   * @param config - Zoho Desk service configuration
   * @param zohoAccountsApi - accounts API used for OAuth token management
   */
  constructor(
    @Inject(ZohoDeskServiceConfig) readonly config: ZohoDeskServiceConfig,
    @Inject(ZohoAccountsApi) readonly zohoAccountsApi: ZohoAccountsApi
  ) {
    this.zohoDesk = zohoDeskFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoDesk);
  }

  // MARK: Ticket Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTickets}.
   *
   * @returns a function that lists Desk tickets matching the supplied filter/pagination input
   */
  get getTickets() {
    return zohoDeskGetTickets(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketById}.
   *
   * @returns a function that fetches a single Desk ticket by its identifier
   */
  get getTicketById() {
    return zohoDeskGetTicketById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTickets}.
   *
   * @returns a function that runs a Desk ticket search with the provided criteria
   */
  get searchTickets() {
    return zohoDeskSearchTickets(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsForContact}.
   *
   * @returns a function that lists Desk tickets associated with the given contact id
   */
  get getTicketsForContact() {
    return zohoDeskGetTicketsForContact(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsForProduct}.
   *
   * @returns a function that lists Desk tickets associated with the given product id
   */
  get getTicketsForProduct() {
    return zohoDeskGetTicketsForProduct(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketMetrics}.
   *
   * @returns a function that fetches aggregated metrics for the requested Desk tickets
   */
  get getTicketMetrics() {
    return zohoDeskGetTicketMetrics(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAgentsTicketsCount}.
   *
   * @returns a function that returns ticket counts grouped by agent for the requested filter
   */
  get getAgentsTicketsCount() {
    return zohoDeskGetAgentsTicketsCount(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk ticket list responses
   */
  get getTicketsPageFactory() {
    return zohoDeskGetTicketsPageFactory(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTicketsPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk ticket search responses
   */
  get searchTicketsPageFactory() {
    return zohoDeskSearchTicketsPageFactory(this.deskContext);
  }

  // MARK: Department Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetDepartments}.
   *
   * @returns a function that lists Desk departments visible to the authenticated portal
   */
  get getDepartments() {
    return zohoDeskGetDepartments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetDepartmentById}.
   *
   * @returns a function that fetches a single Desk department by its identifier
   */
  get getDepartmentById() {
    return zohoDeskGetDepartmentById(this.deskContext);
  }

  // MARK: Contact Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetContacts}.
   *
   * @returns a function that lists Desk contacts matching the supplied filter/pagination input
   */
  get getContacts() {
    return zohoDeskGetContacts(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactById}.
   *
   * @returns a function that fetches a single Desk contact by its identifier
   */
  get getContactById() {
    return zohoDeskGetContactById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactsByIds}.
   *
   * @returns a function that fetches multiple Desk contacts in a single request by their identifiers
   */
  get getContactsByIds() {
    return zohoDeskGetContactsByIds(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactsPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk contact list responses
   */
  get getContactsPageFactory() {
    return zohoDeskGetContactsPageFactory(this.deskContext);
  }

  // MARK: Tag Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketTags}.
   *
   * @returns a function that lists the tags currently associated with a given Desk ticket
   */
  get getTicketTags() {
    return zohoDeskGetTicketTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskAssociateTicketTags}.
   *
   * @returns a function that associates one or more tags with a Desk ticket
   */
  get associateTicketTags() {
    return zohoDeskAssociateTicketTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDissociateTicketTag}.
   *
   * @returns a function that removes a single tag association from a Desk ticket
   */
  get dissociateTicketTag() {
    return zohoDeskDissociateTicketTag(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTags}.
   *
   * @returns a function that searches the Desk tag catalog by the supplied criteria
   */
  get searchTags() {
    return zohoDeskSearchTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAllTags}.
   *
   * @returns a function that lists every tag defined on the Desk portal
   */
  get getAllTags() {
    return zohoDeskGetAllTags(this.deskContext);
  }

  // MARK: Follower Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketFollowers}.
   *
   * @returns a function that lists the agents following a given Desk ticket
   */
  get getTicketFollowers() {
    return zohoDeskGetTicketFollowers(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskAddTicketFollowers}.
   *
   * @returns a function that adds one or more agents as followers of a Desk ticket
   */
  get addTicketFollowers() {
    return zohoDeskAddTicketFollowers(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskRemoveTicketFollowers}.
   *
   * @returns a function that removes one or more agents from a Desk ticket's follower list
   */
  get removeTicketFollowers() {
    return zohoDeskRemoveTicketFollowers(this.deskContext);
  }

  // MARK: Attachment Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketAttachments}.
   *
   * @returns a function that lists the file attachments on a given Desk ticket
   */
  get getTicketAttachments() {
    return zohoDeskGetTicketAttachments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDeleteTicketAttachment}.
   *
   * @returns a function that deletes a single attachment from a Desk ticket by attachment id
   */
  get deleteTicketAttachment() {
    return zohoDeskDeleteTicketAttachment(this.deskContext);
  }

  // MARK: Comment Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketComments}.
   *
   * @returns a function that lists the comments on a given Desk ticket
   */
  get getTicketComments() {
    return zohoDeskGetTicketComments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketCommentById}.
   *
   * @returns a function that fetches a single comment on a Desk ticket by comment id
   */
  get getTicketCommentById() {
    return zohoDeskGetTicketCommentById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskCreateTicketComment}.
   *
   * @returns a function that creates a new comment on a Desk ticket from the supplied body
   */
  get createTicketComment() {
    return zohoDeskCreateTicketComment(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDeleteTicketComment}.
   *
   * @returns a function that deletes a single comment from a Desk ticket by comment id
   */
  get deleteTicketComment() {
    return zohoDeskDeleteTicketComment(this.deskContext);
  }

  // MARK: Time Tracking Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimer}.
   *
   * @returns a function that fetches the current timer state for a Desk ticket
   */
  get getTicketTimer() {
    return zohoDeskGetTicketTimer(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskPerformTicketTimerAction}.
   *
   * @returns a function that performs a timer action (start/pause/stop) on a Desk ticket
   */
  get performTicketTimerAction() {
    return zohoDeskPerformTicketTimerAction(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntries}.
   *
   * @returns a function that lists the time entries logged against a Desk ticket
   */
  get getTicketTimeEntries() {
    return zohoDeskGetTicketTimeEntries(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntryById}.
   *
   * @returns a function that fetches a single time entry on a Desk ticket by entry id
   */
  get getTicketTimeEntryById() {
    return zohoDeskGetTicketTimeEntryById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntrySummation}.
   *
   * @returns a function that fetches the aggregated time-entry totals for a Desk ticket
   */
  get getTicketTimeEntrySummation() {
    return zohoDeskGetTicketTimeEntrySummation(this.deskContext);
  }

  // MARK: Thread Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketThreads}.
   *
   * @returns a function that lists the conversation threads on a given Desk ticket
   */
  get getTicketThreads() {
    return zohoDeskGetTicketThreads(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketThreadById}.
   *
   * @returns a function that fetches a single thread on a Desk ticket by thread id
   */
  get getTicketThreadById() {
    return zohoDeskGetTicketThreadById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketThreadsPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk ticket thread responses
   */
  get getTicketThreadsPageFactory() {
    return zohoDeskGetTicketThreadsPageFactory(this.deskContext);
  }

  // MARK: Activity Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketActivities}.
   *
   * @returns a function that lists the activity log entries for a given Desk ticket
   */
  get getTicketActivities() {
    return zohoDeskGetTicketActivities(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketActivitiesPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk ticket activity responses
   */
  get getTicketActivitiesPageFactory() {
    return zohoDeskGetTicketActivitiesPageFactory(this.deskContext);
  }

  // MARK: Agent Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetAgents}.
   *
   * @returns a function that lists Desk agents matching the supplied filter/pagination input
   */
  get getAgents() {
    return zohoDeskGetAgents(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAgentById}.
   *
   * @returns a function that fetches a single Desk agent by agent id
   */
  get getAgentById() {
    return zohoDeskGetAgentById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAgentsByIds}.
   *
   * @returns a function that fetches multiple Desk agents in a single request by their identifiers
   */
  get getAgentsByIds() {
    return zohoDeskGetAgentsByIds(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetMyInfo}.
   *
   * @returns a function that fetches the profile information for the currently authenticated agent
   */
  get getMyInfo() {
    return zohoDeskGetMyInfo(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAgentsPageFactory}.
   *
   * @returns a paged result factory for iterating over Desk agent list responses
   */
  get getAgentsPageFactory() {
    return zohoDeskGetAgentsPageFactory(this.deskContext);
  }
}
