import {
  type AppCalendarTypeConfigServiceRef,
  type Calendar,
  type CalendarDocument,
  type CalendarFirestoreCollections,
  type CalendarIcsStorageFileMetadata,
  CALENDAR_ICS_STORAGE_FILE_PURPOSE,
  calendarIcsFileStoragePath,
  calendarNextIcsRotateAt,
  isCalendarIcsRotateThrottled,
  calendarsDueForResyncQuery,
  calendarsFlaggedForSyncQuery,
  createStorageFileDocumentPairFactory,
  DEFAULT_CALENDAR_RESYNC_INTERVAL,
  type FirestoreContextReference,
  type FirestoreDocumentSnapshotDataPairWithData,
  firestoreDummyKey,
  type FlagStaleCalendarsForSyncParams,
  flagStaleCalendarsForSyncParamsType,
  type FlagStaleCalendarsForSyncResult,
  getDocumentSnapshotDataPair,
  type RotateCalendarIcsParams,
  rotateCalendarIcsParamsType,
  type RotateCalendarIcsResult,
  iterateFirestoreDocumentSnapshotPairs,
  pruneCalendarEvents,
  type StorageFileFirestoreCollections,
  type StorageFileKey,
  StorageFileState,
  type SyncAllFlaggedCalendarsParams,
  syncAllFlaggedCalendarsParamsType,
  type SyncAllFlaggedCalendarsResult,
  type SyncCalendarParams,
  syncCalendarParamsType,
  type SyncCalendarResult
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerActionsContext, type FirebaseServerStorageServiceRef } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type InjectionToken } from '@nestjs/common';
import { subMilliseconds } from 'date-fns';
import { type StorageFileServerActions } from '../storagefile/storagefile.action.server';
import { markStorageFileForDeleteTemplate } from '../storagefile/storagefile.util';
import { calendarIcsRotateThrottledError } from './calendar.error';

/**
 * NestJS injection token for the {@link BaseCalendarServerActionsContext}.
 */
export const BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_CALENDAR_SERVER_ACTION_CONTEXT';

/**
 * NestJS injection token for the fully assembled {@link CalendarServerActionsContext}.
 */
export const CALENDAR_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'CALENDAR_SERVER_ACTION_CONTEXT';

/**
 * Minimal context providing the Firebase infrastructure, storage and Firestore collections every Calendar
 * server action needs.
 */
export interface BaseCalendarServerActionsContext extends FirebaseServerActionsContext, CalendarFirestoreCollections, StorageFileFirestoreCollections, FirebaseServerStorageServiceRef, FirestoreContextReference {}

/**
 * Full context for the Calendar server actions, adding the type registry and the StorageFile actions the
 * sweep re-flags through.
 */
export interface CalendarServerActionsContext extends BaseCalendarServerActionsContext, AppCalendarTypeConfigServiceRef {
  readonly storageFileServerActions: StorageFileServerActions;
}

/**
 * The publish-side server actions for the Calendar model.
 *
 * PUBLISH-ONLY BY DESIGN. There is no `upsertCalendarEvents` / `removeCalendarEvents` action: a caller
 * already holds a transaction and an accessor when it decides to touch a calendar, so an action that opened
 * its own transaction would either fight the caller's or force an awkward split write. Callers merge the
 * `calendar.util.ts` templates into their own write instead, and those templates carry the `s: true`
 * invariant that makes this sweep correct.
 *
 * {@link CalendarServerActions.rotateCalendarIcs} is the one action with a callable surface
 * (`calendar/update/rotateIcs`), since revoking a published feed url has to be reachable by its owner. It
 * enforces no permission of its own — the callable's role gate is the authorization.
 *
 * @see {@link calendarServerActions} for the concrete implementation factory.
 */
export abstract class CalendarServerActions {
  abstract syncCalendar(params: SyncCalendarParams): Promise<TransformAndValidateFunctionResult<SyncCalendarParams, (calendarDocument: CalendarDocument) => Promise<SyncCalendarResult>>>;
  abstract rotateCalendarIcs(params: RotateCalendarIcsParams): Promise<TransformAndValidateFunctionResult<RotateCalendarIcsParams, (calendarDocument: CalendarDocument) => Promise<RotateCalendarIcsResult>>>;
  abstract syncAllFlaggedCalendars(params: SyncAllFlaggedCalendarsParams): Promise<TransformAndValidateFunctionResult<SyncAllFlaggedCalendarsParams, () => Promise<SyncAllFlaggedCalendarsResult>>>;
  abstract flagStaleCalendarsForSync(params: FlagStaleCalendarsForSyncParams): Promise<TransformAndValidateFunctionResult<FlagStaleCalendarsForSyncParams, () => Promise<FlagStaleCalendarsForSyncResult>>>;
}

/**
 * Creates a concrete {@link CalendarServerActions} implementation from the given context.
 *
 * @param context - The fully assembled calendar server actions context.
 * @returns The server actions.
 */
export function calendarServerActions(context: CalendarServerActionsContext): CalendarServerActions {
  return {
    syncCalendar: syncCalendarFactory(context),
    rotateCalendarIcs: rotateCalendarIcsFactory(context),
    syncAllFlaggedCalendars: syncAllFlaggedCalendarsFactory(context),
    flagStaleCalendarsForSync: flagStaleCalendarsForSyncFactory(context)
  };
}

// MARK: Actions
/**
 * Factory for the `syncCalendar` action, the Calendar counterpart of
 * `regenerateStorageFileGroupContentFactory`.
 *
 * In ONE transaction it prunes the calendar, ensures its ICS StorageFile exists, and clears `s`. It does not
 * write `sat` — that belongs to the processor's success path alone, which is what makes
 * `s === false && sat < uat` mean "queued, not yet published" and lets `flagStaleCalendarsForSync()` heal a
 * run that died in between.
 *
 * The re-flag of an EXISTING ICS StorageFile happens AFTER the transaction commits, through the public
 * `processStorageFile` action rather than the by-convention-private in-transaction helper. That is safe
 * precisely because of the invariant above: a lost re-flag self-heals within one resync interval instead of
 * silently stranding the calendar.
 *
 * @param context - The calendar server actions context.
 * @returns An async transform-and-validate function that syncs a single Calendar.
 */
export function syncCalendarFactory(context: CalendarServerActionsContext) {
  const { firestoreContext, storageService, calendarCollection, storageFileCollection, appCalendarTypeConfigService, storageFileServerActions, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(syncCalendarParamsType, async (_params) => {
    // the ICS StorageFile is DIRECTLY_CREATED: a Calendar is not a StorageFileGroup, so there is no parent
    // to derive a deterministic document id from, and the id lives on Calendar.isf instead
    const createStorageFileDocumentPair = createStorageFileDocumentPairFactory();

    return async (calendarDocument: CalendarDocument) => {
      const { result, reflagStorageFileKey } = await firestoreContext.runTransaction(async (transaction) => {
        const calendarDocumentInTransaction = calendarCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(calendarDocument);
        const calendar = await assertSnapshotData(calendarDocumentInTransaction);
        const storageFileDocumentAccessor = storageFileCollection.documentAccessorForTransaction(transaction);

        const config = appCalendarTypeConfigService.configForCalendarType(calendar.t);
        const pruneResult = pruneCalendarEvents({ calendar, config });

        const updateTemplate: Partial<Calendar> = {
          s: false // clear the sync flag
        };

        // only write the arrays when something actually dropped, otherwise every sweep rewrites both for nothing
        if (pruneResult.changed) {
          updateTemplate.e = pruneResult.e;
          updateTemplate.r = pruneResult.r;
        }

        const existingIcsStorageFileDocument = calendar.isf ? storageFileDocumentAccessor.loadDocumentForId(calendar.isf) : undefined;
        const existingIcsStorageFilePair = existingIcsStorageFileDocument ? await getDocumentSnapshotDataPair(existingIcsStorageFileDocument) : undefined;
        const existingIcsStorageFileIsLive = existingIcsStorageFilePair?.data != null && existingIcsStorageFilePair.data.fs !== StorageFileState.QUEUED_FOR_DELETE;

        let createdIcsStorageFile = false;
        let reflagKey: Maybe<StorageFileKey>;

        if (existingIcsStorageFileIsLive) {
          reflagKey = existingIcsStorageFilePair?.document.key;
        } else {
          const { storageFileDocument } = await createStorageFileDocumentPair<CalendarIcsStorageFileMetadata>({
            // keyed by the StorageFile's own id, so a replacement created while the previous ICS is still
            // QUEUED_FOR_DELETE cannot be clobbered by that file's delete sweep
            storagePathFactory: (storageFileId) => storageService.file(calendarIcsFileStoragePath(storageFileId)).storagePath,
            accessor: storageFileDocumentAccessor,
            purpose: CALENDAR_ICS_STORAGE_FILE_PURPOSE,
            shouldBeProcessed: true,
            ownershipKey: calendar.o,
            displayName: calendar.n,
            metadata: {
              cal: calendarDocument.id
            }
          });

          updateTemplate.isf = storageFileDocument.id;
          createdIcsStorageFile = true;
        }

        await calendarDocumentInTransaction.update(updateTemplate);

        const syncResult: SyncCalendarResult = {
          createdIcsStorageFile,
          prunedEventCount: pruneResult.prunedEventCount,
          prunedRecurringEventCount: pruneResult.prunedRecurringEventCount
        };

        return { result: syncResult, reflagStorageFileKey: reflagKey };
      });

      if (reflagStorageFileKey) {
        const storageFileDocument = storageFileCollection.documentAccessor().loadDocumentForKey(reflagStorageFileKey);
        const processStorageFileInstance = await storageFileServerActions.processStorageFile({ key: reflagStorageFileKey, processAgainIfSuccessful: true });
        await processStorageFileInstance(storageFileDocument);
      }

      return result;
    };
  });
}

/**
 * Factory for the `rotateCalendarIcs` action: the REVOCATION primitive for a published feed url.
 *
 * A published feed url is a bearer credential — unguessable, but permanent until rotated, and stored by a
 * subscriber (Google keeps it in the subscriber's account). Rotation is the only revocation available for a
 * zero-auth feed, which is why it is a first-class action rather than a manual cleanup.
 *
 * It invents no new mechanism. `calendarIcsFileStoragePath()` keys the published object by the ICS
 * StorageFile's OWN id, and `syncCalendarFactory` already mints a fresh StorageFile — new id, new path, new
 * url — whenever the existing one is absent or QUEUED_FOR_DELETE. So in ONE transaction this simply:
 *
 * - flags the current ICS StorageFile for delete (the existing StorageFile delete machinery is what actually
 *   removes the old object, and therefore what actually revokes the old url)
 * - clears `isf` and `iu`, and sets `s: true`
 *
 * `syncCalendar` is then called immediately after the transaction commits, so the replacement exists without
 * waiting for the hourly sweep — and its publish is EXPEDITED (`runImmediately`) rather than left queued, so
 * `iu` normally holds the new url by the time this returns.
 *
 * That expedite is the difference between a rotation and any other sync. Every other path can afford to let
 * the sweep publish, because the calendar still has a working url in the meantime. A rotation does not: it
 * has already revoked the old one, so until the replacement uploads the user has NO link at all. Result
 * field `publishedIcs` reports whether the inline publish landed; the sweep remains the backstop when it
 * did not.
 *
 * @param context - The calendar server actions context.
 * @returns An async transform-and-validate function that rotates a single Calendar's ICS link.
 */
export function rotateCalendarIcsFactory(context: CalendarServerActionsContext) {
  const { firestoreContext, calendarCollection, storageFileCollection, storageFileServerActions, firebaseServerActionTransformFunctionFactory } = context;
  const syncCalendar = syncCalendarFactory(context);

  return firebaseServerActionTransformFunctionFactory(rotateCalendarIcsParamsType, async (_params) => {
    return async (calendarDocument: CalendarDocument) => {
      const now = new Date();

      const revokedIcsStorageFile = await firestoreContext.runTransaction(async (transaction) => {
        const calendarDocumentInTransaction = calendarCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(calendarDocument);
        const calendar = await assertSnapshotData(calendarDocumentInTransaction);
        const storageFileDocumentAccessor = storageFileCollection.documentAccessorForTransaction(transaction);

        // checked INSIDE the transaction, against the same document the write lands on: two rotations racing
        // each other would both pass a pre-transaction check and both revoke, orphaning an ICS object.
        // nextRotateAt is non-null exactly when the predicate is true — both read `rat` — so the null check
        // is type narrowing rather than a second condition.
        const nextRotateAt = calendarNextIcsRotateAt({ calendar });

        if (nextRotateAt != null && isCalendarIcsRotateThrottled({ calendar }, now)) {
          throw calendarIcsRotateThrottledError(nextRotateAt);
        }

        const existingIcsStorageFileDocument = calendar.isf ? storageFileDocumentAccessor.loadDocumentForId(calendar.isf) : undefined;
        const existingIcsStorageFilePair = existingIcsStorageFileDocument ? await getDocumentSnapshotDataPair(existingIcsStorageFileDocument) : undefined;
        const existingIcsStorageFileIsLive = existingIcsStorageFilePair?.data != null && existingIcsStorageFilePair.data.fs !== StorageFileState.QUEUED_FOR_DELETE;

        if (existingIcsStorageFileIsLive) {
          await existingIcsStorageFilePair.document.update(markStorageFileForDeleteTemplate());
        }

        // isf and iu are cleared TOGETHER: a pointer without a url, or a url whose object is queued for
        // delete, are both states the UI would render as a working feed.
        //
        // `rat` is the throttle's only input, and it is set even when there was no live ICS to revoke: a
        // rotation against an unpublished calendar still queues a publish, so letting it run unthrottled
        // would hand out a fresh url on every call.
        await calendarDocumentInTransaction.update({ s: true, isf: null, iu: null, rat: now });

        return existingIcsStorageFileIsLive;
      });

      const syncCalendarInstance = await syncCalendar({ key: calendarDocument.key });
      const syncResult = await syncCalendarInstance(calendarDocument);

      // The sync only QUEUES the replacement's publish, and `iu` is written by the publish itself -- so
      // without this the calendar sits with no url at all until the next sweep, which is the one window
      // where the user has neither the old link (revoked) nor the new one. Expedite it instead.
      //
      // Best-effort by construction: the revocation has already committed, so a failed expedite must not
      // fail the rotation. `shouldBeProcessed` is already set on the replacement, so the regular sweep
      // remains the backstop and the only cost of failing here is latency.
      const icsStorageFileId = (await assertSnapshotData(calendarDocument)).isf;
      let publishedIcs = false;

      if (icsStorageFileId) {
        const icsStorageFileDocument = storageFileCollection.documentAccessor().loadDocumentForId(icsStorageFileId);

        try {
          const processStorageFileInstance = await storageFileServerActions.processStorageFile({ key: icsStorageFileDocument.key, processAgainIfSuccessful: true, runImmediately: true });
          const processResult = await processStorageFileInstance(icsStorageFileDocument);

          publishedIcs = processResult.expediteResult?.notificationTaskCompletionType === true;
        } catch (e) {
          console.error('rotateCalendarIcs(): the expedited ICS publish failed. The calendar remains flagged, so the next sweep will publish it.', e);
        }
      }

      const result: RotateCalendarIcsResult = {
        revokedIcsStorageFile,
        createdIcsStorageFile: syncResult.createdIcsStorageFile,
        publishedIcs
      };

      return result;
    };
  });
}

/**
 * Factory for the `syncAllFlaggedCalendars` action, the Calendar counterpart of
 * `regenerateAllFlaggedStorageFileGroupsContentFactory`.
 *
 * @param context - The calendar server actions context.
 * @returns An async transform-and-validate function that sweeps every flagged Calendar.
 */
export function syncAllFlaggedCalendarsFactory(context: CalendarServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, calendarCollection } = context;
  const syncCalendar = syncCalendarFactory(context);

  return firebaseServerActionTransformFunctionFactory(syncAllFlaggedCalendarsParamsType, async (_params) => {
    return async () => {
      const syncCalendarInstance = await syncCalendar({ key: firestoreDummyKey() });

      let calendarsVisited = 0;
      let calendarsSyncedCount = 0;
      let calendarsFailedCount = 0;

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: calendarCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair: FirestoreDocumentSnapshotDataPairWithData<CalendarDocument>) => {
          calendarsVisited += 1;

          try {
            await syncCalendarInstance(snapshotPair.document);
            calendarsSyncedCount += 1;
          } catch (e) {
            // one badly-configured calendar must not take down the sweep for every other calendar in the app
            console.error(`syncAllFlaggedCalendars(): failed syncing calendar "${snapshotPair.document.id}"`, e);
            calendarsFailedCount += 1;
          }
        },
        queryFactory: calendarCollection,
        constraintsFactory: () => calendarsFlaggedForSyncQuery(),
        performTasksConfig: {
          maxParallelTasks: 10
        },
        totalSnapshotsLimit: 1000,
        limitPerCheckpoint: 100
      });

      const result: SyncAllFlaggedCalendarsResult = {
        calendarsVisited,
        calendarsSyncedCount,
        calendarsFailedCount
      };

      return result;
    };
  });
}

/**
 * Factory for the `flagStaleCalendarsForSync` action: the self-healing backstop.
 *
 * For every registered {@link CalendarType} it re-flags Calendars whose last successful publish predates that
 * type's resync interval. That covers a sweep that cleared `s` but whose ICS never finished publishing, and
 * it keeps an `expand`-mode calendar from sliding off the end of its expansion window — with no extra field
 * and no extra mechanism.
 *
 * @param context - The calendar server actions context.
 * @returns An async transform-and-validate function that re-flags stale Calendars.
 */
export function flagStaleCalendarsForSyncFactory(context: CalendarServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, calendarCollection, appCalendarTypeConfigService } = context;

  return firebaseServerActionTransformFunctionFactory(flagStaleCalendarsForSyncParamsType, async (params) => {
    const { calendarType } = params;

    return async () => {
      const now = new Date();
      const configs = calendarType == null ? appCalendarTypeConfigService.getAllKnownCalendarTypeConfigs() : [appCalendarTypeConfigService.configForCalendarType(calendarType)];

      let calendarsVisited = 0;
      let calendarsFlaggedCount = 0;

      for (const config of configs) {
        const before = subMilliseconds(now, config.resyncInterval ?? DEFAULT_CALENDAR_RESYNC_INTERVAL);

        await iterateFirestoreDocumentSnapshotPairs({
          documentAccessor: calendarCollection.documentAccessor(),
          iterateSnapshotPair: async (snapshotPair: FirestoreDocumentSnapshotDataPairWithData<CalendarDocument>) => {
            const { document, data: calendar } = snapshotPair;
            calendarsVisited += 1;

            if (!calendar.s) {
              await document.update({ s: true });
              calendarsFlaggedCount += 1;
            }
          },
          queryFactory: calendarCollection,
          constraintsFactory: () => calendarsDueForResyncQuery({ calendarType: config.calendarType, before }),
          performTasksConfig: {
            maxParallelTasks: 10
          },
          totalSnapshotsLimit: 1000,
          limitPerCheckpoint: 100
        });
      }

      const result: FlagStaleCalendarsForSyncResult = {
        calendarsVisited,
        calendarsFlaggedCount
      };

      return result;
    };
  });
}
