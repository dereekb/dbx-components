import { type Configurable, type Maybe } from '@dereekb/util';
import { type NotificationExpediteService, type NotificationExpediteServiceInstance, type NotificationExpediteServiceSendNotificationOptions } from './notification.expedite.service';
import { _createNotificationDocumentFromPair, createNotificationDocumentPair, type CreateNotificationDocumentPairInput, type CreateNotificationDocumentPairResult, type SendNotificationResult } from '@dereekb/firebase';

/**
 * Options related to the run
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
 * Alternative version of createNotificationDocument() that checks if the document exists, and can run it if it does instead of recreated it.
 *
 * Does not support the use of a Transaction, as running should occur outside of a transaction.
 *
 * @param input
 * @returns
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
