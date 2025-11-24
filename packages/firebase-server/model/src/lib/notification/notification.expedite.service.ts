import { CreateNotificationDocumentPairResult, firestoreDummyKey, NotificationDocument, SendNotificationParams, SendNotificationResult } from '@dereekb/firebase';
import { NotificationServerActions } from './notification.action.service';
import { Abstract, Injectable, Provider } from '@nestjs/common';
import { runAsyncTasksForValues } from '@dereekb/util';

export type NotificationExpediteServiceSendNotificationOptions = Pick<SendNotificationParams, 'ignoreSendAtThrottle' | 'throwErrorIfSent'>;

/**
 * Interface for a service that allows access to a NotificationServerActions instance and "expediting" the sending of notification(s) that should be emitted immediately for timeliness.
 *
 * @see MutableNotificationExpediteService is the default implementation.
 */
export abstract class NotificationExpediteService {
  /**
   * Returns the configured NotificationServerActions instance.
   */
  abstract getNotificationServerActions(): NotificationServerActions;

  /**
   * Attempts to immediately send/run the input notification document.
   */
  abstract sendNotification(notificationDocument: NotificationDocument, options?: NotificationExpediteServiceSendNotificationOptions): Promise<SendNotificationResult>;

  /**
   * Creates a new NotificationExpediteServiceInstance.
   */
  abstract expediteInstance(): NotificationExpediteServiceInstance;
}

export interface NotificationExpediteServiceInstance {
  /**
   * Resets/initializes the instance.
   */
  initialize(): void;

  /**
   * Enqueues the input notification document to be sent.
   *
   * @param notificationDocument
   */
  enqueue(notificationDocument: NotificationDocument): void;

  /**
   * Enqueues the input CreateNotificationDocumentPairResult to be sent.
   *
   * @param createResult
   * @returns true if the result was enqueued, false otherwise.
   */
  enqueueCreateResult(createResult: CreateNotificationDocumentPairResult): boolean;

  /**
   * Attempts to send all the queued notifications.
   */
  send(options?: NotificationExpediteServiceSendNotificationOptions): Promise<SendNotificationResult[]>;
}

/**
 * Creates a new NotificationExpediteServiceInstance with the input NotificationExpediteService.
 
 * @param notificationExpediteService 
 * @returns 
 */
export function notificationExpediteServiceInstance(notificationExpediteService: NotificationExpediteService): NotificationExpediteServiceInstance {
  let _documentsToSend: NotificationDocument[] = [];

  const initialize = () => {
    _documentsToSend = []; // resets the documents to send
  };

  const enqueue = (notificationDocument: NotificationDocument) => {
    _documentsToSend.push(notificationDocument);
  };

  const enqueueCreateResult = (createResult: CreateNotificationDocumentPairResult) => {
    let enqueued = false;

    if (createResult.notificationDocument) {
      enqueue(createResult.notificationDocument);
      enqueued = true;
    }

    return enqueued;
  };

  const send = async (options?: NotificationExpediteServiceSendNotificationOptions) => {
    const results = await runAsyncTasksForValues(_documentsToSend, (x) => notificationExpediteService.sendNotification(x, options), {
      nonConcurrentTaskKeyFactory: (x) => x.parent.id // only send one notification at a time for a notification box
    });

    return results;
  };

  return {
    initialize,
    enqueue,
    enqueueCreateResult,
    send
  };
}

/**
 * Reference to a NotificationExpediteService.
 */
export interface NotificationExpediteServiceRef {
  readonly notificationExpediteService: NotificationExpediteService;
}

// MARK: Implementation
/**
 * Service used to "expedite" the sending of a specific notification.
 *
 * Because the NotificationActionService is typically created after other action services are due to the dependency injection graph, this service is
 * created before the NotificationActionService is created, and then later updated by the NotificationActionService.
 *
 * It is best provided by provideMutableNotificationExpediteService() as a global provider.
 */
@Injectable()
export class MutableNotificationExpediteService implements NotificationExpediteService {
  private _notificationServerActions!: NotificationServerActions;

  /**
   * Returns the configured NotificationServerActions instance.
   */
  getNotificationServerActions(): NotificationServerActions {
    return this._notificationServerActions;
  }

  /**
   * Sets the NotificationServerActions instance to use.
   */
  setNotificationServerActions(notificationServerActions: NotificationServerActions) {
    this._notificationServerActions = notificationServerActions;
  }

  async sendNotification(notificationDocument: NotificationDocument, options?: NotificationExpediteServiceSendNotificationOptions): Promise<SendNotificationResult> {
    const sendNotification = await this._notificationServerActions.sendNotification({ key: firestoreDummyKey(), ...options });
    return sendNotification(notificationDocument);
  }

  expediteInstance(): NotificationExpediteServiceInstance {
    return notificationExpediteServiceInstance(this);
  }
}

// MARK: Providers
/**
 * Provides an instance of MutableNotificationExpediteService and NotificationExpediteService.
 *
 * This should generally be used in the global module of an app.
 */
export function provideMutableNotificationExpediteService(): Provider[] {
  return [
    MutableNotificationExpediteService,
    {
      provide: NotificationExpediteService,
      useExisting: MutableNotificationExpediteService
    }
  ];
}

/**
 * Convenience function that exports NotificationExpediteService and MutableNotificationExpediteService.
 *
 * This should generally be used in the global module of an app.
 */
export function exportMutableNotificationExpediteService(): Abstract<any>[] {
  return [NotificationExpediteService, MutableNotificationExpediteService];
}
