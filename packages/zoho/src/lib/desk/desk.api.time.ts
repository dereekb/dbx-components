import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId } from './desk';
import { type ZohoDeskTicketTimeEntry, type ZohoDeskTicketTimer } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult } from './desk.api.page';

// MARK: Utility
function zohoDeskTimeApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return { method, body: body ?? undefined };
}

// MARK: Get Ticket Timer
/**
 * Input parameters for retrieving the timer state for a ticket via `GET /tickets/{ticketId}/timer`.
 */
export interface ZohoDeskGetTicketTimerInput {
  readonly ticketId: ZohoDeskTicketId;
}

/**
 * Function that retrieves the timer state for a ticket.
 */
export type ZohoDeskGetTicketTimerFunction = (input: ZohoDeskGetTicketTimerInput) => Promise<ZohoDeskTicketTimer>;

/**
 * Creates a {@link ZohoDeskGetTicketTimerFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves the ticket timer
 */
export function zohoDeskGetTicketTimer(context: ZohoDeskContext): ZohoDeskGetTicketTimerFunction {
  return (input: ZohoDeskGetTicketTimerInput) => context.fetchJson<ZohoDeskTicketTimer>(`/tickets/${input.ticketId}/timer`, zohoDeskTimeApiFetchJsonInput('GET'));
}

// MARK: Perform Timer Action
/**
 * Timer action to perform on a ticket.
 */
export type ZohoDeskTimerAction = 'start' | 'pause' | 'resume' | 'stop';

/**
 * Input parameters for performing a timer action on a ticket via `POST /tickets/{ticketId}/timer`.
 */
export interface ZohoDeskPerformTicketTimerActionInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly timerAction: ZohoDeskTimerAction;
}

/**
 * Function that performs a timer action on a ticket.
 */
export type ZohoDeskPerformTicketTimerActionFunction = (input: ZohoDeskPerformTicketTimerActionInput) => Promise<ZohoDeskTicketTimer>;

/**
 * Creates a {@link ZohoDeskPerformTicketTimerActionFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that performs a timer action on a ticket
 */
export function zohoDeskPerformTicketTimerAction(context: ZohoDeskContext): ZohoDeskPerformTicketTimerActionFunction {
  return (input: ZohoDeskPerformTicketTimerActionInput) => {
    const { ticketId, ...body } = input;
    return context.fetchJson<ZohoDeskTicketTimer>(`/tickets/${ticketId}/timer`, zohoDeskTimeApiFetchJsonInput('POST', body));
  };
}

// MARK: List Ticket Time Entries
/**
 * Input parameters for listing time entries for a ticket via `GET /tickets/{ticketId}/timeEntries`.
 */
export interface ZohoDeskGetTicketTimeEntriesInput extends ZohoDeskPageFilter {
  readonly ticketId: ZohoDeskTicketId;
  readonly billingType?: string;
}

/**
 * Response from listing ticket time entries.
 */
export type ZohoDeskGetTicketTimeEntriesResponse = ZohoDeskPageResult<ZohoDeskTicketTimeEntry>;

/**
 * Function that retrieves time entries for a specific ticket.
 */
export type ZohoDeskGetTicketTimeEntriesFunction = (input: ZohoDeskGetTicketTimeEntriesInput) => Promise<ZohoDeskGetTicketTimeEntriesResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketTimeEntriesFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves time entries for a ticket
 */
export function zohoDeskGetTicketTimeEntries(context: ZohoDeskContext): ZohoDeskGetTicketTimeEntriesFunction {
  return (input: ZohoDeskGetTicketTimeEntriesInput) => {
    const { ticketId, ...rest } = input;
    const params = makeUrlSearchParams([rest]);
    return context.fetchJson<ZohoDeskGetTicketTimeEntriesResponse>(`/tickets/${ticketId}/timeEntries?${params}`, zohoDeskTimeApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Ticket Time Entry By ID
/**
 * Input parameters for retrieving a single time entry via `GET /tickets/{ticketId}/timeEntries/{timeEntryId}`.
 */
export interface ZohoDeskGetTicketTimeEntryByIdInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly timeEntryId: string;
}

/**
 * Function that retrieves a single time entry by ID.
 */
export type ZohoDeskGetTicketTimeEntryByIdFunction = (input: ZohoDeskGetTicketTimeEntryByIdInput) => Promise<ZohoDeskTicketTimeEntry>;

/**
 * Creates a {@link ZohoDeskGetTicketTimeEntryByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single time entry
 */
export function zohoDeskGetTicketTimeEntryById(context: ZohoDeskContext): ZohoDeskGetTicketTimeEntryByIdFunction {
  return (input: ZohoDeskGetTicketTimeEntryByIdInput) => context.fetchJson<ZohoDeskTicketTimeEntry>(`/tickets/${input.ticketId}/timeEntries/${input.timeEntryId}`, zohoDeskTimeApiFetchJsonInput('GET'));
}

// MARK: Get Time Entry Summation
/**
 * Input parameters for getting the summation of time entries via `GET /tickets/{ticketId}/timeEntries/summation`.
 */
export interface ZohoDeskGetTicketTimeEntrySummationInput {
  readonly ticketId: ZohoDeskTicketId;
}

/**
 * Summation of time entries for a ticket.
 */
export interface ZohoDeskTicketTimeEntrySummation {
  readonly totalHours?: Maybe<string>;
  readonly totalMinutes?: Maybe<string>;
  readonly totalCost?: Maybe<string>;
}

/**
 * Function that retrieves the summation of time entries for a ticket.
 */
export type ZohoDeskGetTicketTimeEntrySummationFunction = (input: ZohoDeskGetTicketTimeEntrySummationInput) => Promise<ZohoDeskTicketTimeEntrySummation>;

/**
 * Creates a {@link ZohoDeskGetTicketTimeEntrySummationFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves time entry summation
 */
export function zohoDeskGetTicketTimeEntrySummation(context: ZohoDeskContext): ZohoDeskGetTicketTimeEntrySummationFunction {
  return (input: ZohoDeskGetTicketTimeEntrySummationInput) => context.fetchJson<ZohoDeskTicketTimeEntrySummation>(`/tickets/${input.ticketId}/timeEntries/summation`, zohoDeskTimeApiFetchJsonInput('GET'));
}
