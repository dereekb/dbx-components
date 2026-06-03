import {
  type FirebaseFunctionTypeConfigMap,
  type FirestoreModelKey,
  type ModelFirebaseCreateFunction,
  type ModelFirebaseCrudFunction,
  type ModelFirebaseCrudFunctionConfigMap,
  type ModelFirebaseFunctionMap,
  type ModelFirebaseInvokeFunction,
  type ModelFirebaseQueryFunction,
  type AbstractSubscribeToNotificationBoxParams,
  abstractSubscribeToNotificationBoxParamsType,
  type TargetModelParams,
  targetModelParamsType,
  callModelFirebaseFunctionMapFactory,
  type OnCallQueryModelRequestParams,
  type OnCallQueryModelResult
} from '@dereekb/firebase';
import { type, type Type } from 'arktype';
import { type Guestbook, type GuestbookEntry, type GuestbookTypes } from './guestbook';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type GuestbookKey } from './guestbook.id';
import { type ProfileId } from '../profile';

export const GUESTBOOK_NAME_MAX_LENGTH = 40;

export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;
export const GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH = 40;

export interface CreateGuestbookParams {
  readonly name: string;
  readonly published?: Maybe<boolean>;
  readonly cby?: Maybe<ProfileId>;
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

export interface LikeGuestbookEntryParams extends TargetModelParams {}

export const likeGuestbookEntryParamsType = targetModelParamsType as Type<LikeGuestbookEntryParams>;

/**
 * Parameters for the `guestbook / update / publish` call. One-way publish of the targeted guestbook.
 */
export interface PublishGuestbookParams extends TargetModelParams {}

export const publishGuestbookParamsType = targetModelParamsType as Type<PublishGuestbookParams>;

export interface SubscribeToGuestbookNotificationsParams extends AbstractSubscribeToNotificationBoxParams {}

export const subscribeToGuestbookNotificationsParamsType = abstractSubscribeToNotificationBoxParamsType as Type<SubscribeToGuestbookNotificationsParams>;

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

/**
 * MCP-mapped projection of {@link AllPublishedGuestbookEntriesResult}.
 *
 * Returned to MCP clients via the handler's `mapSuccessfulResult` mapper — drops the potentially
 * large `entries` array (an LLM rarely needs every full entry document) down to the aggregate
 * counts, demonstrating how MCP access can strip unhelpful information from a callModel result.
 */
export interface AllPublishedGuestbookEntriesMcpResult {
  /**
   * Number of published entries gathered.
   */
  readonly count: number;
  /**
   * Whether the server-side hard cap was hit before the collection group was exhausted.
   */
  readonly hitLimit: boolean;
}

/**
 * Parameters for the `guestbookEntry / invoke / entryDetails` RPC.
 *
 * Targets a single GuestbookEntry by key (the store's current document) and
 * returns a computed summary. Exists primarily as a keyed-invoke example
 * exercising {@link firebaseDocumentStoreInvokeFunction}.
 */
export interface EntryDetailsGuestbookEntryParams extends TargetModelParams {}

export const entryDetailsGuestbookEntryParamsType = targetModelParamsType as Type<EntryDetailsGuestbookEntryParams>;

/**
 * Result of an entry-details invoke — a small computed projection of the targeted GuestbookEntry.
 */
export interface EntryDetailsGuestbookEntryResult {
  readonly key: FirestoreModelKey;
  readonly messageLength: number;
  readonly signedLength: number;
  readonly published: boolean;
  readonly likes: number;
  readonly ageMs: Milliseconds;
}

export type GuestbookFunctionTypeMap = {};

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: {
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
      publish: PublishGuestbookParams;
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
      /**
       * @dbxModelApiMcpResult AllPublishedGuestbookEntriesMcpResult
       */
      allPublishedEntries: [AllPublishedGuestbookEntriesParams, AllPublishedGuestbookEntriesResult];
      entryDetails: [EntryDetailsGuestbookEntryParams, EntryDetailsGuestbookEntryResult];
    };
  };
};

export const guestbookModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<GuestbookModelCrudFunctionsConfig, GuestbookTypes> = {
  guestbook: ['create', 'update:subscribeToNotifications,publish', 'query'],
  guestbookEntry: ['update:insert,like', 'delete', 'query:_,entries', 'invoke:allPublishedEntries,entryDetails']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory(guestbookFunctionTypeConfigMap, guestbookModelCrudFunctionsConfig);

export abstract class GuestbookFunctions implements ModelFirebaseFunctionMap<GuestbookFunctionTypeMap, GuestbookModelCrudFunctionsConfig> {
  abstract guestbook: {
    createGuestbook: ModelFirebaseCreateFunction<CreateGuestbookParams>;
    updateGuestbook: {
      subscribeToNotifications: ModelFirebaseCrudFunction<SubscribeToGuestbookNotificationsParams>;
      publish: ModelFirebaseCrudFunction<PublishGuestbookParams>;
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
      entryDetails: ModelFirebaseInvokeFunction<EntryDetailsGuestbookEntryParams, EntryDetailsGuestbookEntryResult>;
    };
  };
}
