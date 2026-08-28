import {
  type AppFormSpaceTypeConfigServiceRef,
  type DeleteFormSpaceParams,
  deleteFormSpaceParamsType,
  type ExpireAllExpiredFormSpacesParams,
  expireAllExpiredFormSpacesParamsType,
  type ExpireAllExpiredFormSpacesResult,
  expireFormSpaceTemplate,
  type FirestoreContextReference,
  type FormSpace,
  type FormSpaceDocument,
  type FormSpaceFirestoreCollections,
  type FormSpaceFileSlot,
  FormSpaceProcessingState,
  formSpaceSubmissionNotificationTaskTemplate,
  formSpaceTemplate,
  formSpacesDueForExpirationQuery,
  formSpacesQueuedForProcessingQuery,
  isFormSpaceEditable,
  iterateFirestoreDocumentSnapshotPairs,
  type NotificationFirestoreCollections,
  type ProcessAllQueuedFormSpacesParams,
  processAllQueuedFormSpacesParamsType,
  type ProcessAllQueuedFormSpacesResult,
  requiredFormSpaceFileSlots,
  resolveFormSpaceExpiresAt,
  type StorageFileFirestoreCollections,
  storageFilesForFormSpaceQuery,
  type SubmitFormSpaceParams,
  submitFormSpaceParamsType,
  type SubmitFormSpaceResult,
  submitFormSpaceTemplate,
  type CreateFormSpaceParams,
  createFormSpaceParamsType,
  type UpdateFormSpaceParams,
  updateFormSpaceParamsType
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type InjectionToken } from '@nestjs/common';
import { type NotificationExpediteServiceRef } from '../notification/notification.expedite.service';
import { createOrRunUniqueNotificationDocument } from '../notification/notification.create.run';
import { queryAndFlagStorageFilesForDelete } from '../storagefile/storagefile.util';
import { formSpaceNotEditableError, formSpaceRequiredSlotMissingError, formSpaceTypeNotRegisteredError } from './formspace.error';

/**
 * NestJS injection token for the {@link BaseFormSpaceServerActionsContext}.
 */
export const BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_FORM_SPACE_SERVER_ACTION_CONTEXT';

/**
 * NestJS injection token for the fully assembled {@link FormSpaceServerActionsContext}.
 */
export const FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'FORM_SPACE_SERVER_ACTION_CONTEXT';

/**
 * Default page size for {@link expireAllExpiredFormSpacesFactory}.
 */
export const DEFAULT_FORM_SPACE_EXPIRATION_SWEEP_PAGE_SIZE = 50;

/**
 * Default wall-clock budget for {@link expireAllExpiredFormSpacesFactory}: one minute.
 */
export const DEFAULT_FORM_SPACE_EXPIRATION_SWEEP_MAX_RUN_TIME: Milliseconds = 60 * 1000;

/**
 * Minimal context providing the Firebase infrastructure and Firestore collections every FormSpace server
 * action needs.
 */
export interface BaseFormSpaceServerActionsContext extends FirebaseServerActionsContext, FormSpaceFirestoreCollections, StorageFileFirestoreCollections, NotificationFirestoreCollections, NotificationExpediteServiceRef, FirebaseServerAuthServiceRef, FirestoreContextReference {}

/**
 * Full context for the FormSpace server actions, adding the type registry.
 */
export interface FormSpaceServerActionsContext extends BaseFormSpaceServerActionsContext, AppFormSpaceTypeConfigServiceRef {}

/**
 * Extra input for {@link FormSpaceServerActions.createFormSpace}, supplied by the callable rather than by
 * the caller: the space's owner is WHO IS CALLING, never a value in the request body.
 */
export interface CreateFormSpaceActionInput {
  readonly uid: string;
  readonly ownerKey?: Maybe<string>;
}

/**
 * The server actions for the FormSpace model.
 *
 * @see {@link formSpaceServerActions} for the concrete implementation factory.
 */
export abstract class FormSpaceServerActions {
  abstract createFormSpace(params: CreateFormSpaceParams): Promise<TransformAndValidateFunctionResult<CreateFormSpaceParams, (input: CreateFormSpaceActionInput) => Promise<FormSpaceDocument>>>;
  abstract updateFormSpace(params: UpdateFormSpaceParams): Promise<TransformAndValidateFunctionResult<UpdateFormSpaceParams, (formSpaceDocument: FormSpaceDocument) => Promise<FormSpaceDocument>>>;
  abstract submitFormSpace(params: SubmitFormSpaceParams): Promise<TransformAndValidateFunctionResult<SubmitFormSpaceParams, (formSpaceDocument: FormSpaceDocument) => Promise<SubmitFormSpaceResult>>>;
  abstract deleteFormSpace(params: DeleteFormSpaceParams): Promise<TransformAndValidateFunctionResult<DeleteFormSpaceParams, (formSpaceDocument: FormSpaceDocument) => Promise<void>>>;
  abstract processAllQueuedFormSpaces(params: ProcessAllQueuedFormSpacesParams): Promise<TransformAndValidateFunctionResult<ProcessAllQueuedFormSpacesParams, () => Promise<ProcessAllQueuedFormSpacesResult>>>;
  abstract expireAllExpiredFormSpaces(params: ExpireAllExpiredFormSpacesParams): Promise<TransformAndValidateFunctionResult<ExpireAllExpiredFormSpacesParams, () => Promise<ExpireAllExpiredFormSpacesResult>>>;
}

/**
 * Creates a concrete {@link FormSpaceServerActions} implementation from the given context.
 *
 * @param context - The fully assembled FormSpace server actions context.
 * @returns The server actions.
 */
export function formSpaceServerActions(context: FormSpaceServerActionsContext): FormSpaceServerActions {
  return {
    createFormSpace: createFormSpaceFactory(context),
    updateFormSpace: updateFormSpaceFactory(context),
    submitFormSpace: submitFormSpaceFactory(context),
    deleteFormSpace: deleteFormSpaceFactory(context),
    processAllQueuedFormSpaces: processAllQueuedFormSpacesFactory(context),
    expireAllExpiredFormSpaces: expireAllExpiredFormSpacesFactory(context)
  };
}

// MARK: Actions
/**
 * Factory for the `createFormSpace` action.
 *
 * Rejects an unregistered {@link FormSpaceType} outright. This is the one place the registry is STRICT —
 * a sweep over existing documents falls back to the default config so one bad document cannot take the
 * pass down, but a space that could never be filled in or submitted should not be created at all.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that creates a FormSpace.
 */
export function createFormSpaceFactory(context: FormSpaceServerActionsContext) {
  const { formSpaceCollection, appFormSpaceTypeConfigService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(createFormSpaceParamsType, async (params) => {
    const { formSpaceType, displayName, targetModelKey, data } = params;
    const config = appFormSpaceTypeConfigService.registeredConfigForFormSpaceType(formSpaceType);

    if (config == null) {
      throw formSpaceTypeNotRegisteredError(formSpaceType);
    }

    return async ({ uid, ownerKey }: CreateFormSpaceActionInput) => {
      const now = new Date();

      const template = formSpaceTemplate({
        formSpaceType,
        uid,
        ownerKey,
        targetModelKey,
        displayName,
        data,
        expiresAt: resolveFormSpaceExpiresAt({ config, now }),
        now
      });

      const formSpaceDocument = formSpaceCollection.documentAccessor().newDocument();
      await formSpaceDocument.create(template);

      return formSpaceDocument;
    };
  });
}

/**
 * Factory for the `updateFormSpace` action.
 *
 * `data` REPLACES the stored JSON rather than merging into it — the client owns the whole form, and a
 * merge would make clearing a field impossible to express.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that updates a draft FormSpace.
 */
export function updateFormSpaceFactory(context: FormSpaceServerActionsContext) {
  const { firestoreContext, formSpaceCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(updateFormSpaceParamsType, async (params) => {
    const { displayName, data } = params;

    return async (formSpaceDocument: FormSpaceDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const documentInTransaction = formSpaceCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(formSpaceDocument);
        const formSpace = await assertSnapshotData(documentInTransaction);

        if (!isFormSpaceEditable({ formSpace })) {
          throw formSpaceNotEditableError();
        }

        const updateTemplate: Partial<FormSpace> = { uat: new Date() };

        if (displayName !== undefined) {
          updateTemplate.n = displayName;
        }

        if (data !== undefined) {
          updateTemplate.d = data;
        }

        await documentInTransaction.update(updateTemplate);
      });

      return formSpaceDocument;
    };
  });
}

/**
 * Factory for the `submitFormSpace` action.
 *
 * The LOCK is taken in a transaction; the processing task is created afterwards. That split is deliberate:
 * `createOrRunUniqueNotificationDocument()` does not accept a transaction, since running a task inside one
 * would hold the lock across the whole handler. A crash in between leaves the space in
 * QUEUED_FOR_PROCESSING with no task, which {@link processAllQueuedFormSpacesFactory} is the backstop for.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that submits a FormSpace.
 */
export function submitFormSpaceFactory(context: FormSpaceServerActionsContext) {
  const { firestoreContext, formSpaceCollection, appFormSpaceTypeConfigService, firebaseServerActionTransformFunctionFactory } = context;
  const queueFormSpaceForProcessing = _queueFormSpaceForProcessingFactory(context);

  return firebaseServerActionTransformFunctionFactory(submitFormSpaceParamsType, async (params) => {
    const { runImmediately } = params;

    return async (formSpaceDocument: FormSpaceDocument) => {
      // The required-slot check runs BEFORE the transaction because it is a QUERY, and a query cannot be
      // interleaved with the transaction's writes. It is safe there: a slot cannot become empty on its own
      // — only an upload fills one, and uploads are already refused once the space stops being editable,
      // which the transaction below re-asserts under the lock.
      const formSpace = await assertSnapshotData(formSpaceDocument);

      if (!isFormSpaceEditable({ formSpace })) {
        throw formSpaceNotEditableError();
      }

      const config = appFormSpaceTypeConfigService.configForFormSpaceType(formSpace.t);
      const requiredSlots = requiredFormSpaceFileSlots(config);

      if (requiredSlots.length > 0) {
        const filledSlots = await _filledFormSpaceFileSlots(context, formSpaceDocument);
        const missingSlots = requiredSlots.filter((x) => !filledSlots.has(x));

        if (missingSlots.length > 0) {
          throw formSpaceRequiredSlotMissingError(missingSlots);
        }
      }

      await firestoreContext.runTransaction(async (transaction) => {
        const documentInTransaction = formSpaceCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(formSpaceDocument);
        const current = await assertSnapshotData(documentInTransaction);

        // re-asserted under the lock: this is what makes a concurrent double-submit resolve to one winner
        if (!isFormSpaceEditable({ formSpace: current })) {
          throw formSpaceNotEditableError();
        }

        await documentInTransaction.update(submitFormSpaceTemplate());
      });

      return queueFormSpaceForProcessing(formSpaceDocument, runImmediately);
    };
  });
}

/**
 * Reads back which slots this FormSpace's StorageFiles actually occupy.
 *
 * Queries the StorageFiles DIRECTLY rather than reading the StorageFileGroup's embedded `f[]`: the group is
 * created and populated lazily by the group-sync sweep, so immediately after an upload its `f[]` is still
 * empty and a required slot would look unsatisfied. The StorageFile itself carries `g` and `pg` the moment
 * the upload is accepted, which makes it the only source that is correct at submit time.
 *
 * A file already flagged for deletion does not count: that is a superseded slot, and its replacement — if
 * there is one — carries the same `pg` and fills the slot on its own.
 *
 * @param context - The FormSpace server actions context.
 * @param formSpaceDocument - The FormSpace whose files to inspect.
 * @returns The set of slots that currently hold a live file.
 */
async function _filledFormSpaceFileSlots(context: FormSpaceServerActionsContext, formSpaceDocument: FormSpaceDocument): Promise<Set<FormSpaceFileSlot>> {
  const { storageFileCollection } = context;
  const storageFiles = await storageFileCollection.queryDocument(storageFilesForFormSpaceQuery(formSpaceDocument.key)).getDocs();
  const snapshots = await Promise.all(storageFiles.map((x) => x.snapshotData()));
  const filled = new Set<FormSpaceFileSlot>();

  snapshots.forEach((x) => {
    if (x?.pg && !x.sdat) {
      filled.add(x.pg);
    }
  });

  return filled;
}

/**
 * Creates (or re-runs) the unique submission task for a FormSpace and records its key on `pn`.
 *
 * Shared by `submitFormSpace` and the queued backstop sweep, which is what makes the backstop safe to run
 * against a space whose task already exists: the task is unique per space, so a second attempt resolves to
 * the same document rather than racing a second processor.
 *
 * @param context - The FormSpace server actions context.
 * @returns Queues one FormSpace, reporting the task key and whether this call created it.
 */
export function _queueFormSpaceForProcessingFactory(context: FormSpaceServerActionsContext) {
  const { notificationExpediteService } = context;

  return async (formSpaceDocument: FormSpaceDocument, runImmediately?: Maybe<boolean>): Promise<SubmitFormSpaceResult> => {
    const expediteInstance = runImmediately ? notificationExpediteService.expediteInstance() : undefined;
    expediteInstance?.initialize();

    const createResult = await createOrRunUniqueNotificationDocument({
      context,
      template: formSpaceSubmissionNotificationTaskTemplate({ formSpaceDocument }),
      runImmediatelyIfCreated: runImmediately ?? false,
      expediteInstance
    });

    const processingNotificationKey = createResult.notificationDocument.key;

    await formSpaceDocument.update({
      ps: FormSpaceProcessingState.QUEUED_FOR_PROCESSING,
      pn: processingNotificationKey
    });

    if (expediteInstance) {
      await expediteInstance.send();
    }

    return {
      processingNotificationKey,
      processingTaskCreated: createResult.notificationCreated === true
    };
  };
}

/**
 * Factory for the `deleteFormSpace` action.
 *
 * Files are FLAGGED, not deleted: the StorageFile delete sweep owns removing the object from GCS, and
 * duplicating that here would mean a second code path that can leave an orphaned object behind.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that deletes a FormSpace and flags its files.
 */
export function deleteFormSpaceFactory(context: FormSpaceServerActionsContext) {
  const { storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(deleteFormSpaceParamsType, async (_params) => {
    return async (formSpaceDocument: FormSpaceDocument) => {
      await queryAndFlagStorageFilesForDelete({
        storageFileCollection,
        constraints: storageFilesForFormSpaceQuery(formSpaceDocument.key)
      });

      await formSpaceDocument.accessor.delete();
    };
  });
}

/**
 * Factory for the `processAllQueuedFormSpaces` action.
 *
 * The BACKSTOP for a submission whose task creation was lost between the lock transaction and the task
 * write. It is safe to run against a space whose task already exists because the task is unique per space.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that returns batch processing results.
 */
export function processAllQueuedFormSpacesFactory(context: FormSpaceServerActionsContext) {
  const { formSpaceCollection, firebaseServerActionTransformFunctionFactory } = context;
  const queueFormSpaceForProcessing = _queueFormSpaceForProcessingFactory(context);

  return firebaseServerActionTransformFunctionFactory(processAllQueuedFormSpacesParamsType, async (params) => {
    const { limit } = params;

    return async () => {
      let formSpacesVisited = 0;
      let formSpacesProcessStarted = 0;
      let formSpacesFailedStarting = 0;

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: formSpaceCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair) => {
          formSpacesVisited++;

          const queued = await queueFormSpaceForProcessing(snapshotPair.document).catch(() => null);

          if (queued) {
            formSpacesProcessStarted++;
          } else {
            formSpacesFailedStarting++;
          }
        },
        constraintsFactory: () => formSpacesQueuedForProcessingQuery(limit),
        queryFactory: formSpaceCollection,
        batchSize: undefined,
        performTasksConfig: {
          maxParallelTasks: 10
        }
      });

      const result: ProcessAllQueuedFormSpacesResult = {
        formSpacesVisited,
        formSpacesProcessStarted,
        formSpacesFailedStarting
      };

      return result;
    };
  });
}

/**
 * Factory for the `expireAllExpiredFormSpaces` action.
 *
 * A PAGED sweep with a pinned cutoff and a hard time budget, copying `openRouterRunTaskExpirationSweep`.
 * `firestoreDate` persists an ISO8601 string, so Firestore's native TTL cannot be pointed at `eat` — this
 * sweep is the mechanism, not a stopgap.
 *
 * No cursor is needed and one would be meaningless: expiring a page clears its `eat`, so the page no
 * longer matches and re-running the query IS the next page. An empty page is therefore the only "done"
 * signal, which is why the cutoff must be pinned — a cutoff advancing with the clock would let a space
 * that ages mid-sweep join a page not yet reached, making the pass unbounded.
 *
 * @param context - The FormSpace server actions context.
 * @returns An async transform-and-validate function that expires due FormSpaces.
 */
export function expireAllExpiredFormSpacesFactory(context: FormSpaceServerActionsContext) {
  const { formSpaceCollection, storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(expireAllExpiredFormSpacesParamsType, async (params) => {
    const { before, pageSize, maxRunTimeMs, maxPages } = params;

    return async () => {
      const startedAt = Date.now();
      const budget = maxRunTimeMs ?? DEFAULT_FORM_SPACE_EXPIRATION_SWEEP_MAX_RUN_TIME;
      const limit = pageSize ?? DEFAULT_FORM_SPACE_EXPIRATION_SWEEP_PAGE_SIZE;
      const cutoff = before ?? new Date(startedAt);

      let formSpacesExpired = 0;
      let storageFilesFlaggedForDelete = 0;
      let pages = 0;
      let stoppedForTimeBudget = false;

      const elapsed = () => Date.now() - startedAt;

      for (;;) {
        if (elapsed() >= budget) {
          stoppedForTimeBudget = true;
          break;
        }

        if (maxPages != null && pages >= maxPages) {
          break;
        }

        const documents = await formSpaceCollection.queryDocument(formSpacesDueForExpirationQuery({ before: cutoff, limit })).getDocs();

        if (documents.length === 0) {
          break;
        }

        for (const formSpaceDocument of documents) {
          const flagResult = await queryAndFlagStorageFilesForDelete({
            storageFileCollection,
            constraints: storageFilesForFormSpaceQuery(formSpaceDocument.key)
          });

          storageFilesFlaggedForDelete += flagResult.queuedForDeleteCount;

          // eat is cleared here, which is what removes the space from the query above and makes the next
          // page the remainder rather than the same page again
          await formSpaceDocument.update(expireFormSpaceTemplate());
          formSpacesExpired++;
        }

        pages += 1;
      }

      const result: ExpireAllExpiredFormSpacesResult = {
        formSpacesExpired,
        storageFilesFlaggedForDelete,
        pages,
        stoppedForTimeBudget,
        durationMs: elapsed()
      };

      return result;
    };
  });
}
