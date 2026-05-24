import { type FirebaseFunctionTypeConfigMap, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseQueryFunction, type AbstractSubscribeToNotificationBoxParams, type TargetModelParams, callModelFirebaseFunctionMapFactory, type OnCallQueryModelRequestParams, type OnCallQueryModelResult } from '@dereekb/firebase';
import { type, type Type } from 'arktype';
import { type Guestbook, type GuestbookEntry, type GuestbookTypes } from './guestbook';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type GuestbookKey } from './guestbook.id';

export const GUESTBOOK_NAME_MAX_LENGTH = 40;

export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;
export const GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH = 40;

export interface CreateGuestbookParams {
  readonly name: string;
  readonly published?: Maybe<boolean>;
}

export const createGuestbookParamsType = type({
  name: `string > 0 & string <= ${GUESTBOOK_NAME_MAX_LENGTH}`,
  'published?': clearable('boolean')
}) as Type<CreateGuestbookParams>;

export interface GuestbookEntryParams {
  readonly guestbook: string; // ModelKey;
}

export const guestbookEntryParamsType = type({
  guestbook: 'string > 0'
}) as Type<GuestbookEntryParams>;

export interface InsertGuestbookEntryParams extends GuestbookEntryParams {
  readonly message?: string;
  readonly signed?: string;
  readonly published?: boolean;
}

export const insertGuestbookEntryParamsType = guestbookEntryParamsType.merge({
  'message?': clearable(`string > 0 & string <= ${GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH}`),
  'signed?': clearable(`string > 0 & string <= ${GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH}`),
  'published?': clearable('boolean')
}) as Type<InsertGuestbookEntryParams>;

export type LikeGuestbookEntryParams = TargetModelParams;

export { targetModelParamsType as likeGuestbookEntryParamsType } from '@dereekb/firebase';

export type SubscribeToGuestbookNotificationsParams = AbstractSubscribeToNotificationBoxParams;

export { abstractSubscribeToNotificationBoxParamsType as subscribeToGuestbookNotificationsParamsType } from '@dereekb/firebase';

// MARK: Query
/**
 * Query parameters for searching guestbooks.
 */
export interface QueryGuestbooksParams extends OnCallQueryModelRequestParams {
  /**
   * Filter by published status. When omitted, returns all guestbooks.
   */
  readonly published?: boolean;
}

/**
 * Query parameters for searching guestbook entries for one guestbook.
 *
 * Used with the default `guestbookEntry.query._` specifier — for cross-guestbook
 * collection-group queries, see {@link QueryAllGuestbookEntriesParams}.
 */
export interface QueryGuestbookEntriesParams extends OnCallQueryModelRequestParams {
  /**
   * Key of the parent guestbook to query entries from. Required.
   */
  readonly guestbook: GuestbookKey;
  /**
   * Filter by published status. When omitted, returns all entries.
   */
  readonly published?: boolean;
}

/**
 * Query parameters for searching GuestbookEntry across all guestbooks via the collection group.
 *
 * Used with the `guestbookEntry.query.entries` specifier — unlike
 * {@link QueryGuestbookEntriesParams}, the parent guestbook key is NOT required.
 */
export interface QueryAllGuestbookEntriesParams extends OnCallQueryModelRequestParams {
  /**
   * Filter by published status. When omitted, returns all entries the caller is allowed to see
   * (server-side admin gate may restrict non-admins to `published: true`).
   */
  readonly published?: boolean;
}

// MARK: Invoke
/**
 * Parameters for the `guestbookEntry / invoke / allPublishedEntries` RPC.
 *
 * Server-side equivalent of the client-side
 * {@link QUERY_ALL_PUBLISHED_GUESTBOOK_ENTRIES_ACTION} composition — paginates
 * the cross-guestbook query internally and returns one aggregate response. Use
 * this when the caller wants a single round trip instead of driving pagination.
 */
export interface AllPublishedGuestbookEntriesParams {
  /**
   * Cap the number of entries returned. The server enforces an additional hard upper bound.
   */
  readonly limit?: Maybe<number>;
}

export const allPublishedGuestbookEntriesParamsType = type({
  'limit?': clearable('number > 0')
}) as Type<AllPublishedGuestbookEntriesParams>;

/**
 * Result of an all-published-entries invoke.
 */
export interface AllPublishedGuestbookEntriesResult {
  readonly count: number;
  readonly entries: ReadonlyArray<GuestbookEntry>;
  readonly hitLimit: boolean;
}

export type GuestbookFunctionTypeMap = {};

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: {
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
    };
    query: [QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>];
  };
  guestbookEntry: {
    update: {
      insert: InsertGuestbookEntryParams;
      like: LikeGuestbookEntryParams;
    };
    delete: GuestbookEntryParams;
    query: {
      _: [QueryGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>];
      entries: [QueryAllGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>];
    };
    invoke: {
      allPublishedEntries: [AllPublishedGuestbookEntriesParams, AllPublishedGuestbookEntriesResult];
    };
  };
};

export const guestbookModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<GuestbookModelCrudFunctionsConfig, GuestbookTypes> = {
  guestbook: ['create', 'update:subscribeToNotifications', 'query'],
  guestbookEntry: ['update:insert,like', 'delete', 'query:_,entries', 'invoke:allPublishedEntries']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory(guestbookFunctionTypeConfigMap, guestbookModelCrudFunctionsConfig);

export abstract class GuestbookFunctions implements ModelFirebaseFunctionMap<GuestbookFunctionTypeMap, GuestbookModelCrudFunctionsConfig> {
  abstract guestbook: {
    createGuestbook: ModelFirebaseCreateFunction<CreateGuestbookParams>;
    updateGuestbook: {
      subscribeToNotifications: ModelFirebaseCrudFunction<SubscribeToGuestbookNotificationsParams>;
    };
    queryGuestbook: ModelFirebaseQueryFunction<QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>>;
  };
  abstract guestbookEntry: {
    updateGuestbookEntry: {
      insert: ModelFirebaseCrudFunction<InsertGuestbookEntryParams>;
      like: ModelFirebaseCrudFunction<LikeGuestbookEntryParams>;
    };
    deleteGuestbookEntry: ModelFirebaseCrudFunction<GuestbookEntryParams>;
    queryGuestbookEntry: {
      query: ModelFirebaseQueryFunction<QueryGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>>;
      entries: ModelFirebaseQueryFunction<QueryAllGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>>;
    };
    invokeGuestbookEntry: {
      allPublishedEntries: ModelFirebaseCrudFunction<AllPublishedGuestbookEntriesParams, AllPublishedGuestbookEntriesResult>;
    };
  };
}
