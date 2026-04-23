import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId, type ZohoDeskContactId, type ZohoDeskProductId, type ZohoDeskDepartmentId, type ZohoDeskAgentId } from './desk';
import { type ZohoDeskTicket, type ZohoDeskTicketSortBy, type ZohoDeskTicketInclude, type ZohoDeskTicketMetrics, type ZohoDeskTicketPriority, type ZohoDeskTicketChannel, type ZohoDeskAgentTicketCount } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult, zohoDeskFetchPageFactory } from './desk.api.page';

// MARK: Utility
/**
 * Constructs the standard FetchJsonInput used by Desk API calls, pairing the HTTP method with an optional body.
 *
 * @param method - HTTP method to use for the request
 * @param body - Optional request body to include
 * @returns Configured fetch input for the Zoho Desk API call
 */
export function zohoDeskApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return {
    method,
    body: body ?? undefined
  };
}

/**
 * Builds URL search params from the input objects, omitting keys that are used in the URL path.
 *
 * @param input - One or more objects to convert into URL search parameters
 * @param omitKeys - Keys to exclude from the search params
 * @returns URL search params string
 */
function zohoDeskUrlSearchParams(input: Maybe<object | Record<string, string | number>>[], omitKeys?: string | string[]) {
  return makeUrlSearchParams(input, { omitKeys });
}

/**
 * Joins include values into a comma-separated string.
 *
 * @param include - Single or array of include values
 * @returns Comma-separated string, or undefined if no values provided
 */
function joinInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: Get Tickets
/**
 * Input parameters for listing tickets via `GET /tickets`.
 */
export interface ZohoDeskGetTicketsInput extends ZohoDeskPageFilter {
  readonly sortBy?: ZohoDeskTicketSortBy;
  readonly include?: ArrayOrValue<ZohoDeskTicketInclude>;
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly departmentIds?: string;
  readonly channel?: ZohoDeskTicketChannel;
  readonly priority?: ZohoDeskTicketPriority;
  readonly receivedInDays?: number;
  readonly viewId?: string;
  readonly assignee?: string;
  readonly fields?: string;
  readonly status?: string;
}

/**
 * Response from listing tickets, containing an array of tickets.
 */
export type ZohoDeskGetTicketsResponse = ZohoDeskPageResult<ZohoDeskTicket>;

/**
 * Function that retrieves a paginated list of tickets.
 */
export type ZohoDeskGetTicketsFunction = (input: ZohoDeskGetTicketsInput) => Promise<ZohoDeskGetTicketsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketsFunction} bound to the given context.
 *
 * Retrieves a paginated list of tickets from Zoho Desk, with optional filtering by
 * department, status, priority, channel, assignee, and view.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves paginated tickets
 */
export function zohoDeskGetTickets(context: ZohoDeskContext): ZohoDeskGetTicketsFunction {
  return (input: ZohoDeskGetTicketsInput) => {
    const { include, ...rest } = input;
    const params = zohoDeskUrlSearchParams([{ ...rest, include: joinInclude(include) }]);
    return context.fetchJson<ZohoDeskGetTicketsResponse>(`/tickets?${params}`, zohoDeskApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Ticket By ID
/**
 * Input parameters for retrieving a single ticket via `GET /tickets/{ticketId}`.
 */
export interface ZohoDeskGetTicketByIdInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly include?: ArrayOrValue<ZohoDeskTicketInclude>;
}

/**
 * Function that retrieves a single ticket by ID.
 */
export type ZohoDeskGetTicketByIdFunction = (input: ZohoDeskGetTicketByIdInput) => Promise<ZohoDeskTicket>;

/**
 * Creates a {@link ZohoDeskGetTicketByIdFunction} bound to the given context.
 *
 * Retrieves a single ticket by its ID, with optional inline expansion of related entities.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single ticket
 */
export function zohoDeskGetTicketById(context: ZohoDeskContext): ZohoDeskGetTicketByIdFunction {
  return (input: ZohoDeskGetTicketByIdInput) => {
    const { ticketId, include } = input;
    const params = zohoDeskUrlSearchParams([{ include: joinInclude(include) }]);
    const queryString = params.toString();
    return context.fetchJson<ZohoDeskTicket>(`/tickets/${ticketId}${queryString ? `?${queryString}` : ''}`, zohoDeskApiFetchJsonInput('GET'));
  };
}

// MARK: Search Tickets
/**
 * Input parameters for searching tickets via `GET /tickets/search`.
 */
export interface ZohoDeskSearchTicketsInput extends ZohoDeskPageFilter {
  readonly sortBy?: ZohoDeskTicketSortBy;
  readonly ticketNumber?: string;
  readonly subject?: string;
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly channel?: string;
  readonly customerResponseTimeRange?: string;
  readonly description?: string;
  readonly productName?: string;
  readonly all?: string;
  readonly dueDateRange?: string;
  readonly id?: ZohoDeskTicketId;
  readonly tag?: string;
  readonly email?: string;
  readonly productId?: ZohoDeskProductId;
  readonly contactId?: ZohoDeskContactId;
  readonly contactName?: string;
  readonly createdTimeRange?: string;
  readonly priority?: ZohoDeskTicketPriority;
  readonly assigneeId?: ZohoDeskAgentId;
  readonly accountId?: string;
  readonly phone?: string;
  readonly modifiedTimeRange?: string;
  readonly category?: string;
  readonly status?: string;
  readonly customField1?: string;
  readonly customField2?: string;
  readonly customField3?: string;
  readonly customField4?: string;
  readonly customField5?: string;
  readonly customField6?: string;
  readonly customField7?: string;
  readonly customField8?: string;
  readonly customField9?: string;
  readonly customField10?: string;
}

/**
 * Response from searching tickets.
 */
export type ZohoDeskSearchTicketsResponse = ZohoDeskPageResult<ZohoDeskTicket>;

/**
 * Function that searches for tickets.
 */
export type ZohoDeskSearchTicketsFunction = (input: ZohoDeskSearchTicketsInput) => Promise<ZohoDeskSearchTicketsResponse>;

/**
 * Creates a {@link ZohoDeskSearchTicketsFunction} bound to the given context.
 *
 * Searches for tickets matching the given filter criteria. Supports filtering by
 * many fields including subject, email, status, priority, date ranges, and custom fields.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that searches for tickets
 */
export function zohoDeskSearchTickets(context: ZohoDeskContext): ZohoDeskSearchTicketsFunction {
  return (input: ZohoDeskSearchTicketsInput) => {
    const params = zohoDeskUrlSearchParams([input]);
    return context.fetchJson<ZohoDeskSearchTicketsResponse>(`/tickets/search?${params}`, zohoDeskApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Tickets For Contact
/**
 * Input parameters for listing tickets for a specific contact via `GET /contacts/{contactId}/tickets`.
 */
export interface ZohoDeskGetTicketsForContactInput extends ZohoDeskPageFilter {
  readonly contactId: ZohoDeskContactId;
  readonly sortBy?: ZohoDeskTicketSortBy;
  readonly include?: ArrayOrValue<ZohoDeskTicketInclude>;
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly status?: string;
}

/**
 * Function that retrieves tickets for a specific contact.
 */
export type ZohoDeskGetTicketsForContactFunction = (input: ZohoDeskGetTicketsForContactInput) => Promise<ZohoDeskPageResult<ZohoDeskTicket>>;

/**
 * Creates a {@link ZohoDeskGetTicketsForContactFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves tickets for a contact
 */
export function zohoDeskGetTicketsForContact(context: ZohoDeskContext): ZohoDeskGetTicketsForContactFunction {
  return (input: ZohoDeskGetTicketsForContactInput) => {
    const { contactId, include, ...rest } = input;
    const params = zohoDeskUrlSearchParams([{ ...rest, include: joinInclude(include) }]);
    return context.fetchJson<ZohoDeskPageResult<ZohoDeskTicket>>(`/contacts/${contactId}/tickets?${params}`, zohoDeskApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Tickets For Product
/**
 * Input parameters for listing tickets for a specific product via `GET /products/{productId}/tickets`.
 */
export interface ZohoDeskGetTicketsForProductInput extends ZohoDeskPageFilter {
  readonly productId: ZohoDeskProductId;
  readonly sortBy?: ZohoDeskTicketSortBy;
  readonly include?: ArrayOrValue<ZohoDeskTicketInclude>;
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly status?: string;
}

/**
 * Function that retrieves tickets for a specific product.
 */
export type ZohoDeskGetTicketsForProductFunction = (input: ZohoDeskGetTicketsForProductInput) => Promise<ZohoDeskPageResult<ZohoDeskTicket>>;

/**
 * Creates a {@link ZohoDeskGetTicketsForProductFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves tickets for a product
 */
export function zohoDeskGetTicketsForProduct(context: ZohoDeskContext): ZohoDeskGetTicketsForProductFunction {
  return (input: ZohoDeskGetTicketsForProductInput) => {
    const { productId, include, ...rest } = input;
    const params = zohoDeskUrlSearchParams([{ ...rest, include: joinInclude(include) }]);
    return context.fetchJson<ZohoDeskPageResult<ZohoDeskTicket>>(`/products/${productId}/tickets?${params}`, zohoDeskApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Ticket Metrics
/**
 * Input parameters for retrieving ticket metrics via `GET /tickets/{ticketId}/metrics`.
 */
export interface ZohoDeskGetTicketMetricsInput {
  readonly ticketId: ZohoDeskTicketId;
}

/**
 * Function that retrieves metrics for a specific ticket.
 */
export type ZohoDeskGetTicketMetricsFunction = (input: ZohoDeskGetTicketMetricsInput) => Promise<ZohoDeskTicketMetrics>;

/**
 * Creates a {@link ZohoDeskGetTicketMetricsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves ticket metrics
 */
export function zohoDeskGetTicketMetrics(context: ZohoDeskContext): ZohoDeskGetTicketMetricsFunction {
  return (input: ZohoDeskGetTicketMetricsInput) => context.fetchJson<ZohoDeskTicketMetrics>(`/tickets/${input.ticketId}/metrics`, zohoDeskApiFetchJsonInput('GET'));
}

// MARK: Get Agents Tickets Count
/**
 * Input parameters for retrieving agent ticket counts via `GET /agentsTicketsCount`.
 */
export interface ZohoDeskGetAgentsTicketsCountInput {
  readonly agentIds: ArrayOrValue<ZohoDeskAgentId>;
  readonly departmentId?: ZohoDeskDepartmentId;
}

/**
 * Function that retrieves ticket counts per agent.
 */
export type ZohoDeskGetAgentsTicketsCountFunction = (input: ZohoDeskGetAgentsTicketsCountInput) => Promise<ZohoDeskAgentTicketCount[]>;

/**
 * Creates a {@link ZohoDeskGetAgentsTicketsCountFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves agent ticket counts
 */
export function zohoDeskGetAgentsTicketsCount(context: ZohoDeskContext): ZohoDeskGetAgentsTicketsCountFunction {
  return (input: ZohoDeskGetAgentsTicketsCountInput) => {
    const params = zohoDeskUrlSearchParams([
      {
        agentIds: joinStringsWithCommas(asArray(input.agentIds)),
        departmentId: input.departmentId
      }
    ]);
    return context.fetchJson<ZohoDeskAgentTicketCount[]>(`/agentsTicketsCount?${params}`, zohoDeskApiFetchJsonInput('GET'));
  };
}

// MARK: Page Factories
/**
 * Factory that creates paginated iterators for ticket list queries.
 */
export type ZohoDeskGetTicketsPageFactory = (input: ZohoDeskGetTicketsInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskGetTicketsInput, ZohoDeskGetTicketsResponse>>) => FetchPage<ZohoDeskGetTicketsInput, ZohoDeskGetTicketsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketsPageFactory} bound to the given context.
 *
 * Returns a page factory that automatically handles Zoho Desk's offset-based pagination,
 * making it easy to iterate through all tickets across multiple pages.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over ticket results
 */
export function zohoDeskGetTicketsPageFactory(context: ZohoDeskContext): ZohoDeskGetTicketsPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskGetTickets(context));
}

/**
 * Factory that creates paginated iterators for ticket search queries.
 */
export type ZohoDeskSearchTicketsPageFactory = (input: ZohoDeskSearchTicketsInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskSearchTicketsInput, ZohoDeskSearchTicketsResponse>>) => FetchPage<ZohoDeskSearchTicketsInput, ZohoDeskSearchTicketsResponse>;

/**
 * Creates a {@link ZohoDeskSearchTicketsPageFactory} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over search results
 */
export function zohoDeskSearchTicketsPageFactory(context: ZohoDeskContext): ZohoDeskSearchTicketsPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskSearchTickets(context));
}
