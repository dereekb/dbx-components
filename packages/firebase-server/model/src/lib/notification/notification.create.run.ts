import { type Configurable, type Maybe } from '@dereekb/util';
import { type NotificationExpediteService, type NotificationExpediteServiceInstance, type NotificationExpediteServiceSendNotificationOptions } from './notification.expedite.service';
import { _createNotificationDocumentFromPair, createNotificationDocumentPair, type CreateNotificationDocumentPairInput, type CreateNotificationDocumentPairResult, type SendNotificationResult } from '@dereekb/firebase';

/**
 * Input for {@link createOrRunUniqueNotificationDocument}, extending the standard notification document
 * creation input with options for immediate execution or expedited delivery.
 */
export interface CreateOrRunUniqueNotificationDocumentRunInput extends Omit<CreateNotificationDocumentPairInput, 'transaction'> {
  /**
   * Overrides/skips the existence check.
   */
  readonly exists?: Maybe<boolean>;
  /**
   * Whether or not to run the notification immediately if it is created.
   *
   * Defaults to false.
   */
  readonly runImmediatelyIfCreated?: Maybe<boolean>;
  /**
   * Whether or not to update the next run at time to the given time.
   *
   * Defaults to true if neither expediteService nor expediteInstance are provided.
   *
   * If the document is being created, this will set the "sat" field.
   */
  readonly updateNextRunAtTime?: Maybe<Date | true>;
  /**
   * The ExpediteService to expedite a run. If provided, the task will be created then run immediately.
   */
  readonly expediteService?: Maybe<NotificationExpediteService>;
  /**
   * Options to pass to sendNotification(), if expediteService is provided.
   */
  readonly sendNotificationOptions?: Maybe<NotificationExpediteServiceSendNotificationOptions>;
  /**
   * The ExpediteServiceInstance to expedite a run. If provided, the task will be enqueued into the
   */
  readonly expediteInstance?: Maybe<NotificationExpediteServiceInstance>;
}

/**
 * Result of {@link createOrRunUniqueNotificationDocument}, extending the pair result with
 * optional send/enqueue outcomes.
 */
export interface CreateOrRunUniqueNotificationDocumentRunResult extends CreateNotificationDocumentPairResult {
  /**
   * Set if the notification was run.
   */
  readonly runResult?: Maybe<SendNotificationResult>;
  /**
   * Set if the notification was enqueued.
   */
  readonly runEnqueued?: Maybe<boolean>;
}

/**
 * Creates a unique notification document if it doesn't exist, or triggers a send/expedite
 * if the document already exists.
 *
 * This is the idempotent alternative to `createNotificationDocument()` for notifications
 * flagged as unique (`ut=true`). The behavior varies based on whether the document exists:
 *
 * - **Document does not exist**: Creates it and optionally runs it immediately via `runImmediatelyIfCreated`.
 * - **Document already exists**: Triggers the notification via the expedite service/instance,
 *   or updates the `sat` (send-at time) if `updateNextRunAtTime` is set.
 *
 * Does not support Firestore transactions, as running should occur outside of a transaction.
 *
 * @param input - creation and run configuration
 * @returns the creation pair result with optional send/enqueue outcomes
 * @throws Error if the notification template is not flagged as unique
 *
 * @example
 * ```ts
 * const result = await createOrRunUniqueNotificationDocument({
 *   ...createInput,
 *   runImmediatelyIfCreated: true,
 *   expediteService
 * });
 *
 * if (result.notificationCreated) {
 *   // newly created
 * } else if (result.runResult) {
 *   // existing doc was re-sent
 * }
 * ```
 */
export async function createOrRunUniqueNotificationDocument(input: CreateOrRunUniqueNotificationDocumentRunInput): Promise<CreateOrRunUniqueNotificationDocumentRunResult> {
  const { expediteService, expediteInstance, updateNextRunAtTime, now: inputNow } = input;
  let sat: Maybe<Date> = input.template.sat;

  if (updateNextRunAtTime != null) {
    sat = updateNextRunAtTime === true ? (inputNow ?? new Date()) : updateNextRunAtTime;
  }

  const pair = createNotificationDocumentPair({
    ...input,
    template: {
      ...input.template,
      sat
    }
  });

  if (!pair.notification.ut) {
    throw new Error('createOrRunUniqueNotificationDocument(): Notification is not flagged as unique.');
  }

  const pairExists = await pair.notificationDocument.exists();

  let result: CreateOrRunUniqueNotificationDocumentRunResult = {
    ...pair,
    notificationCreated: false
  };

  async function runNotificationTask() {
    if (expediteService != null) {
      (result as Configurable<CreateOrRunUniqueNotificationDocumentRunResult>).runResult = await expediteService.sendNotification(pair.notificationDocument, input.sendNotificationOptions);
    } else if (expediteInstance != null) {
      expediteInstance.enqueue(pair.notificationDocument);
      (result as Configurable<CreateOrRunUniqueNotificationDocumentRunResult>).runEnqueued = true;
    } else if (!result.notificationCreated && updateNextRunAtTime != null) {
      await pair.notificationDocument.update({
        sat: sat as Date
      });
    }
  }

  if (pairExists) {
    await runNotificationTask();
  } else {
    result = await _createNotificationDocumentFromPair(input, pair);

    if (result.notificationCreated && input.runImmediatelyIfCreated) {
      await runNotificationTask();
    }
  }

  return result;
}
