import { timeHasExpired } from '@dereekb/date';
import { type Building, type Maybe, type Milliseconds, type ModelKey, MS_IN_HOUR, objectHasNoKeys } from '@dereekb/util';
import { type Notification, type NotificationDocument, type NotificationFirestoreCollections, NotificationSendState, NotificationSendType } from './notification';
import { type NotificationRecipientWithConfig } from './notification.config';
import { notificationBoxIdForModel, type NotificationTemplateType } from './notification.id';
import { type FirebaseAuthUserId, type FirestoreDocumentAccessor, type ReadFirestoreModelKeyInput, type Transaction, readFirestoreModelKey } from '../../common';
import { type NotificationItem } from './notification.item';

/**
 * Template item for a new Notification
 */
export interface CreateNotificationTemplateItem extends Omit<NotificationItem, 'id' | 'cat'> {
  /**
   * Custom created at date for the item.
   */
  cat?: Maybe<Date>;
}

/**
 * Template use for creating a new Notification
 */
export interface CreateNotificationTemplate extends Partial<Omit<Notification, 'n' | 'a' | 'd'>> {
  /**
   * Model key of the NotificationBox's target model (not the NotificationBox's key)
   */
  notificationModel: ModelKey;
  /**
   * Item template
   */
  n: CreateNotificationTemplateItem;
}

export interface CreateNotificationTemplateInput extends Partial<Omit<CreateNotificationTemplate, 'notificationModel'>>, Partial<Omit<CreateNotificationTemplateItem, 't'>> {
  /**
   * Model key input of the NotificationBox's target model (not the NotificationBox/key)
   */
  readonly notificationModel: ReadFirestoreModelKeyInput;
  /**
   * Template type
   */
  readonly type: NotificationTemplateType;
  /**
   * Overrides st
   */
  readonly sendType?: NotificationSendType;
  /**
   * Overrides r
   */
  readonly recipients?: NotificationRecipientWithConfig[];
  /**
   * Overrides cb
   */
  readonly createdBy?: Maybe<FirebaseAuthUserId>;
  /**
   * Overrides m
   */
  readonly targetModel?: Maybe<ReadFirestoreModelKeyInput>;
  /**
   * Overrides s
   */
  readonly subject?: Maybe<string>;
  /**
   * Overrides g
   */
  readonly message?: Maybe<string>;
  /**
   * Overrides d
   */
  readonly data?: Maybe<object>;
}

export function createNotificationTemplate(input: CreateNotificationTemplateInput): CreateNotificationTemplate {
  const {
    notificationModel: inputNotification,
    type,
    // notification
    sendType,
    recipients,
    st,
    r,
    rf,
    sat,
    // item
    createdBy,
    targetModel: inputTargetModel,
    subject,
    message,
    data,
    cat,
    cb,
    s,
    m,
    g,
    d: inputD
  } = input;

  const notificationModel = readFirestoreModelKey(inputNotification) as string;
  const targetModel = inputTargetModel ? readFirestoreModelKey(inputTargetModel) : undefined;
  let d = data ?? inputD;

  if (d && objectHasNoKeys(d)) {
    d = undefined;
  }

  const template: CreateNotificationTemplate = {
    notificationModel,
    st: sendType ?? st,
    sat,
    rf,
    r: recipients ?? r,
    n: {
      cat,
      t: type,
      cb: createdBy ?? cb,
      m: targetModel ?? m,
      s: subject ?? s,
      g: message ?? g,
      d
    }
  };

  return template;
}

// MARK: Create
export interface ShouldSendCreatedNotificationInput {
  /**
   * Whether or not to actually create/save the notification. Defaults to true.
   */
  readonly sendNotification?: Maybe<boolean>;
  /**
   * Date that can be provided to throttle sending notifications. If the throttle time has not elapsed since the last send then the notification will not be sent.
   */
  readonly sendNotificationThrottleDate?: Maybe<Date>;
  /**
   * Amount of time to throttle notifications. Only used if sendNotificationThrottleDate is provided. Defaults to 1 hour.
   */
  readonly sendNotificationThrottleTime?: Maybe<number>;
}

/**
 * Returns true if the notification should be created/sent, given the input.
 *
 * @param input
 * @returns
 */
export function shouldSendCreatedNotificationInput(input: ShouldSendCreatedNotificationInput): boolean {
  const { sendNotification, sendNotificationThrottleDate, sendNotificationThrottleTime: inputSendNotificationThrottleTime } = input;
  const sendNotificationThrottleTime: Milliseconds = inputSendNotificationThrottleTime ?? MS_IN_HOUR;
  const isNotThrottled = sendNotificationThrottleDate ? timeHasExpired(sendNotificationThrottleDate, sendNotificationThrottleTime) : true;
  return sendNotification !== false && isNotThrottled;
}

export interface CreateNotificationDocumentPairInput extends ShouldSendCreatedNotificationInput {
  /**
   * Additional flag controlling whether or not to create the notification.
   */
  readonly shouldCreateNotification?: Maybe<boolean>;
  /**
   * Template
   */
  readonly template: CreateNotificationTemplate;
  /**
   * Transaction, if available.
   */
  readonly transaction?: Maybe<Transaction>;
  /**
   * Context to create the accessor from.
   */
  readonly context?: Pick<NotificationFirestoreCollections, 'notificationCollectionFactory' | 'notificationBoxCollection'>;
  /**
   * Accessor to use directly.
   */
  readonly accessor?: FirestoreDocumentAccessor<Notification, NotificationDocument>;
}

export interface CreateNotificationDocumentPairResult {
  readonly notificationDocument: NotificationDocument;
  readonly notification: Notification;
  /**
   * Whether or not the notification was created.
   */
  readonly notificationCreated: boolean;
}

/**
 * Creates a CreateNotificationDocumentPairResult from the input.
 *
 * Only creates a pair. Used createNotificationDocument() to also save the document's data.
 *
 * @param template
 */
export function createNotificationDocumentPair(input: CreateNotificationDocumentPairInput): CreateNotificationDocumentPairResult {
  const { template, accessor: inputAccessor, transaction, context } = input;
  const { notificationModel, st, sat, r, rf, n, ts, es, ps, ns } = template;

  let accessor = inputAccessor;
  const notificationBoxId = notificationBoxIdForModel(notificationModel);

  if (!accessor && notificationBoxId) {
    if (context) {
      const { notificationCollectionFactory, notificationBoxCollection } = context;
      const notificationBoxDocument = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationBoxId);
      accessor = notificationCollectionFactory(notificationBoxDocument).documentAccessorForTransaction(transaction);
    }
  }

  if (!accessor) {
    throw new Error('createNotificationDocument() failed as neither an accessor nor sufficient information was provided about the target.');
  }

  const notificationDocument: NotificationDocument = accessor.newDocument();
  const id = notificationDocument.id;

  const notification: Notification = {
    st: st ?? NotificationSendType.INIT_BOX_AND_SEND,
    sat: sat ?? new Date(),
    rf,
    r: r ?? [],
    n: {
      id,
      cat: n.cat ?? new Date(),
      t: n.t,
      cb: n.cb,
      m: n.m,
      s: n.s,
      g: n.g,
      d: n.d
    },
    a: 0,
    d: false,
    ts: ts ?? NotificationSendState.QUEUED,
    es: es ?? NotificationSendState.QUEUED,
    ps: ps ?? NotificationSendState.QUEUED,
    ns: ns ?? NotificationSendState.QUEUED
  };

  return {
    notificationDocument,
    notification,
    notificationCreated: false
  };
}

/**
 * Creates a new Notification and saves it to Firestore. Returns the pair.
 *
 * @param input
 */
export async function createNotificationDocument(input: CreateNotificationDocumentPairInput): Promise<CreateNotificationDocumentPairResult> {
  const pair = createNotificationDocumentPair(input);
  const { notification, notificationDocument } = pair;

  if (input.shouldCreateNotification !== false && shouldSendCreatedNotificationInput(input)) {
    await notificationDocument.create(notification);
    (pair as Building<CreateNotificationDocumentPairResult>).notificationCreated = true;
  }

  return pair;
}

/**
 * Creates a new Notification and saves it to Firestore and returns the pair if sendNotification in the input is not false.
 *
 * @param input
 * @returns
 */
export async function createNotificationDocumentIfSending(input: CreateNotificationDocumentPairInput): Promise<Maybe<CreateNotificationDocumentPairResult>> {
  const pair = await createNotificationDocument(input);
  if (pair.notificationCreated) {
    return pair;
  } else {
    return undefined;
  }
}
