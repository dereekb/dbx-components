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
  type OnCallCreateModelResult,
  type OnCallQueryModelRequestParams,
  type OnCallQueryModelResult,
  firestoreModelIdsFromKey,
  isFirestoreModelId,
  isFirestoreModelKey,
  onCallQueryModelRequestParamsType
} from '@dereekb/firebase';
import { type, type Type } from 'arktype';
import { type Guestbook, type GuestbookEntry, type GuestbookTypes, guestbookIdentity } from './guestbook';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type GuestbookEntryKey, type GuestbookId, type GuestbookKey } from './guestbook.id';
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

/**
 * What a `guestbook` param accepts.
 *
 * ArkType reads a type's description as what a value "must be", so this one phrase is both the param's schema
 * description and its validation message.
 */
export const GUESTBOOK_ID_OR_KEY_PARAM_DESCRIPTION = `a guestbook id ("abc123") or full key ("${guestbookIdentity.collectionName}/abc123")`;

/**
 * ArkType validator for a `guestbook` param: a {@link GuestbookId} or a full {@link GuestbookKey}.
 *
 * Only the shape is checked: a bare id, or a key with a single `collection/id` pair. That refuses a GuestbookEntry key
 * here instead of letting it reach Firestore as a malformed path. The collection itself is checked when the param is
 * loaded (`loadDocumentForIdOrKey`), against the accessor's real collection.
 */
export const guestbookIdOrKeyType = /* @__PURE__ */ type('string > 0')
  .narrow((value, ctx) => isFirestoreModelId(value) || (isFirestoreModelKey(value) && firestoreModelIdsFromKey(value).length === 1) || ctx.mustBe(GUESTBOOK_ID_OR_KEY_PARAM_DESCRIPTION))
  .describe(GUESTBOOK_ID_OR_KEY_PARAM_DESCRIPTION);

export interface GuestbookEntryParams {
  /**
   * The guestbook the entry is in: its id (`abc123`) or its full key (`gb/abc123`).
   */
  readonly guestbook: GuestbookId | GuestbookKey;
}

export const guestbookEntryParamsType = type({
  guestbook: guestbookIdOrKeyType
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

/**
 * Result of the `guestbookEntry / update / insert` call.
 */
export interface InsertGuestbookEntryResult extends OnCallCreateModelResult {
  /**
   * Key of the caller's entry: the one just created, or the existing one that was updated.
   */
  readonly modelKeys: [GuestbookEntryKey];
}

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
   * The guestbook to query entries from: its id (`abc123`) or its full key (`gb/abc123`). Required.
   */
  readonly guestbook: GuestbookId | GuestbookKey;
  /**
   * Filter by published status. When omitted, returns all entries.
   */
  readonly published?: boolean;
}

/**
 * ArkType validator for {@link QueryGuestbookEntriesParams}.
 */
export const queryGuestbookEntriesParamsType = /* @__PURE__ */ onCallQueryModelRequestParamsType.merge({
  guestbook: guestbookIdOrKeyType,
  'published?': clearable('boolean')
}) as Type<QueryGuestbookEntriesParams>;

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
    /**
     * Creates a guestbook owned by the caller.
     *
     * It starts unlocked, and unpublished unless `published` is set. Returns the new guestbook's key in `modelKeys`.
     */
    create: CreateGuestbookParams;
    update: {
      /**
       * Subscribes a user to the notifications of the guestbook targeted by `key`.
       *
       * `uid` defaults to the caller. Only an admin can subscribe another user; anyone else always subscribes themselves.
       */
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
      publish: PublishGuestbookParams;
    };
    query: [QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>];
  };
  guestbookEntry: {
    update: {
      /**
       * Creates or updates the caller's entry in a guestbook. Each user has one entry per guestbook.
       *
       * Pass the guestbook as `guestbook`: its id or its full key. Fails when the guestbook is locked. Returns the entry's
       * key in `modelKeys`.
       */
      insert: [InsertGuestbookEntryParams, InsertGuestbookEntryResult];
      /**
       * Adds one like to the published guestbook entry targeted by `key`, the entry's own key (`gb/<guestbookId>/gbe/<uid>`).
       *
       * Fails when the entry is not published.
       */
      like: LikeGuestbookEntryParams;
    };
    /**
     * Deletes the caller's own entry in a guestbook.
     *
     * Pass the guestbook as `guestbook` (its id or its full key), not the entry's key. An entry's id is its author's uid, so
     * this always targets the caller's entry. Succeeds without changing anything when the caller has no entry.
     */
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
      insert: ModelFirebaseCrudFunction<InsertGuestbookEntryParams, InsertGuestbookEntryResult>;
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
