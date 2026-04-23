import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonInput, type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskContactId } from './desk';
import { type ZohoDeskContact, type ZohoDeskContactSortBy, type ZohoDeskContactInclude } from './desk.contact';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult, zohoDeskFetchPageFactory } from './desk.api.page';

// MARK: Utility
function zohoDeskContactApiFetchJsonInput(method: string): FetchJsonInput {
  return { method };
}

/**
 * Joins include values into a comma-separated string.
 *
 * @param include - Single or array of include values
 * @returns Comma-separated string, or undefined if no values provided
 */
function joinContactInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: Get Contacts
/**
 * Input parameters for listing contacts via `GET /contacts`.
 */
export interface ZohoDeskGetContactsInput extends ZohoDeskPageFilter {
  readonly sortBy?: ZohoDeskContactSortBy;
  readonly include?: ArrayOrValue<ZohoDeskContactInclude>;
  readonly viewId?: string;
  readonly fields?: string;
}

/**
 * Response from listing contacts.
 */
export type ZohoDeskGetContactsResponse = ZohoDeskPageResult<ZohoDeskContact>;

/**
 * Function that retrieves a paginated list of contacts.
 */
export type ZohoDeskGetContactsFunction = (input: ZohoDeskGetContactsInput) => Promise<ZohoDeskGetContactsResponse>;

/**
 * Creates a {@link ZohoDeskGetContactsFunction} bound to the given context.
 *
 * Retrieves a paginated list of contacts from Zoho Desk, with optional sorting,
 * inline expansion of related entities, and custom view filtering.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves paginated contacts
 */
export function zohoDeskGetContacts(context: ZohoDeskContext): ZohoDeskGetContactsFunction {
  return (input: ZohoDeskGetContactsInput) => {
    const { include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinContactInclude(include) }]);
    return context.fetchJson<ZohoDeskGetContactsResponse>(`/contacts?${params}`, zohoDeskContactApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Contact By ID
/**
 * Input parameters for retrieving a single contact via `GET /contacts/{contactId}`.
 */
export interface ZohoDeskGetContactByIdInput {
  readonly contactId: ZohoDeskContactId;
  readonly include?: ArrayOrValue<ZohoDeskContactInclude>;
}

/**
 * Function that retrieves a single contact by ID.
 */
export type ZohoDeskGetContactByIdFunction = (input: ZohoDeskGetContactByIdInput) => Promise<ZohoDeskContact>;

/**
 * Creates a {@link ZohoDeskGetContactByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single contact
 */
export function zohoDeskGetContactById(context: ZohoDeskContext): ZohoDeskGetContactByIdFunction {
  return (input: ZohoDeskGetContactByIdInput) => {
    const { contactId, include } = input;
    const params = makeUrlSearchParams([{ include: joinContactInclude(include) }]);
    const queryString = params.toString();
    return context.fetchJson<ZohoDeskContact>(`/contacts/${contactId}${queryString ? `?${queryString}` : ''}`, zohoDeskContactApiFetchJsonInput('GET'));
  };
}

// MARK: Get Contacts By IDs
/**
 * Input parameters for retrieving multiple contacts by their IDs via `GET /contacts/contactsByIds`.
 */
export interface ZohoDeskGetContactsByIdsInput {
  readonly contactIds: ArrayOrValue<ZohoDeskContactId>;
}

/**
 * Function that retrieves multiple contacts by their IDs.
 */
export type ZohoDeskGetContactsByIdsFunction = (input: ZohoDeskGetContactsByIdsInput) => Promise<ZohoDeskContact[]>;

/**
 * Creates a {@link ZohoDeskGetContactsByIdsFunction} bound to the given context.
 *
 * Retrieves multiple contacts in a single request by providing their IDs.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves contacts by IDs
 */
export function zohoDeskGetContactsByIds(context: ZohoDeskContext): ZohoDeskGetContactsByIdsFunction {
  return (input: ZohoDeskGetContactsByIdsInput) => {
    const params = makeUrlSearchParams([{ contactIds: joinStringsWithCommas(asArray(input.contactIds)) }]);
    return context.fetchJson<ZohoDeskContact[]>(`/contacts/contactsByIds?${params}`, zohoDeskContactApiFetchJsonInput('GET')).then((x) => x ?? []);
  };
}

// MARK: Page Factory
/**
 * Factory that creates paginated iterators for contact list queries.
 */
export type ZohoDeskGetContactsPageFactory = (input: ZohoDeskGetContactsInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskGetContactsInput, ZohoDeskGetContactsResponse>>) => FetchPage<ZohoDeskGetContactsInput, ZohoDeskGetContactsResponse>;

/**
 * Creates a {@link ZohoDeskGetContactsPageFactory} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over contact results
 */
export function zohoDeskGetContactsPageFactory(context: ZohoDeskContext): ZohoDeskGetContactsPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskGetContacts(context));
}
