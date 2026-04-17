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
  zohoDeskGetTicketTimeEntrySummation
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
   */
  get getTickets() {
    return zohoDeskGetTickets(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketById}.
   */
  get getTicketById() {
    return zohoDeskGetTicketById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTickets}.
   */
  get searchTickets() {
    return zohoDeskSearchTickets(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsForContact}.
   */
  get getTicketsForContact() {
    return zohoDeskGetTicketsForContact(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsForProduct}.
   */
  get getTicketsForProduct() {
    return zohoDeskGetTicketsForProduct(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketMetrics}.
   */
  get getTicketMetrics() {
    return zohoDeskGetTicketMetrics(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAgentsTicketsCount}.
   */
  get getAgentsTicketsCount() {
    return zohoDeskGetAgentsTicketsCount(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketsPageFactory}.
   */
  get getTicketsPageFactory() {
    return zohoDeskGetTicketsPageFactory(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTicketsPageFactory}.
   */
  get searchTicketsPageFactory() {
    return zohoDeskSearchTicketsPageFactory(this.deskContext);
  }

  // MARK: Department Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetDepartments}.
   */
  get getDepartments() {
    return zohoDeskGetDepartments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetDepartmentById}.
   */
  get getDepartmentById() {
    return zohoDeskGetDepartmentById(this.deskContext);
  }

  // MARK: Contact Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetContacts}.
   */
  get getContacts() {
    return zohoDeskGetContacts(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactById}.
   */
  get getContactById() {
    return zohoDeskGetContactById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactsByIds}.
   */
  get getContactsByIds() {
    return zohoDeskGetContactsByIds(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetContactsPageFactory}.
   */
  get getContactsPageFactory() {
    return zohoDeskGetContactsPageFactory(this.deskContext);
  }

  // MARK: Tag Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketTags}.
   */
  get getTicketTags() {
    return zohoDeskGetTicketTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskAssociateTicketTags}.
   */
  get associateTicketTags() {
    return zohoDeskAssociateTicketTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDissociateTicketTag}.
   */
  get dissociateTicketTag() {
    return zohoDeskDissociateTicketTag(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskSearchTags}.
   */
  get searchTags() {
    return zohoDeskSearchTags(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetAllTags}.
   */
  get getAllTags() {
    return zohoDeskGetAllTags(this.deskContext);
  }

  // MARK: Follower Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketFollowers}.
   */
  get getTicketFollowers() {
    return zohoDeskGetTicketFollowers(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskAddTicketFollowers}.
   */
  get addTicketFollowers() {
    return zohoDeskAddTicketFollowers(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskRemoveTicketFollowers}.
   */
  get removeTicketFollowers() {
    return zohoDeskRemoveTicketFollowers(this.deskContext);
  }

  // MARK: Attachment Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketAttachments}.
   */
  get getTicketAttachments() {
    return zohoDeskGetTicketAttachments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDeleteTicketAttachment}.
   */
  get deleteTicketAttachment() {
    return zohoDeskDeleteTicketAttachment(this.deskContext);
  }

  // MARK: Comment Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketComments}.
   */
  get getTicketComments() {
    return zohoDeskGetTicketComments(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketCommentById}.
   */
  get getTicketCommentById() {
    return zohoDeskGetTicketCommentById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskCreateTicketComment}.
   */
  get createTicketComment() {
    return zohoDeskCreateTicketComment(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskDeleteTicketComment}.
   */
  get deleteTicketComment() {
    return zohoDeskDeleteTicketComment(this.deskContext);
  }

  // MARK: Time Tracking Accessors
  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimer}.
   */
  get getTicketTimer() {
    return zohoDeskGetTicketTimer(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskPerformTicketTimerAction}.
   */
  get performTicketTimerAction() {
    return zohoDeskPerformTicketTimerAction(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntries}.
   */
  get getTicketTimeEntries() {
    return zohoDeskGetTicketTimeEntries(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntryById}.
   */
  get getTicketTimeEntryById() {
    return zohoDeskGetTicketTimeEntryById(this.deskContext);
  }

  /**
   * Configured pass-through for {@link zohoDeskGetTicketTimeEntrySummation}.
   */
  get getTicketTimeEntrySummation() {
    return zohoDeskGetTicketTimeEntrySummation(this.deskContext);
  }
}
