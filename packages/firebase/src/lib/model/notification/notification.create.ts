import { type Building, type Maybe, type Milliseconds, type ModelKey, MS_IN_HOUR, objectHasNoKeys, filterUndefinedValues, isThrottled } from '@dereekb/util';
import { type Notification, type NotificationDocument, type NotificationFirestoreCollections, NotificationSendState, NotificationSendType } from './notification';
import { type NotificationRecipientWithConfig } from './notification.config';
import { notificationBoxIdForModel, NotificationTaskType, notificationTaskUniqueId, NotificationTaskUniqueId, type NotificationTemplateType } from './notification.id';
import { type FirebaseAuthUserId, type FirestoreDocumentAccessor, type ReadFirestoreModelKeyInput, type Transaction, isFirestoreModelId, readFirestoreModelKey } from '../../common';
import { type NotificationItem } from './notification.item';

/**
 * Template item for a new Notification
 */
export interface CreateNotificationTemplateItem extends Omit<NotificationItem, 'r' | 'id' | 'cat'> {
  /**
   * Custom created at date for the item.
   */
  readonly cat?: Maybe<Date>;
}

/**
 * Template use for creating a new Notification
 */
export interface CreateNotificationTemplate extends Partial<Omit<Notification, 'n' | 'a' | 'd' | 'tsr' | 'esr'>> {
  /**
   * Model key of the NotificationBox's target model (not the NotificationBox's key)
   */
  readonly notificationModel: ModelKey;
  /**
   * Item template
   */
  readonly n: CreateNotificationTemplateItem;
  // MARK: Notification Task Only
  /**
   * Whether or not this notification task is "unique".
   *
   * If true, the notification task will be created using a unique key based on the target model's id and the task type.
   *
   * If a string, the notification task will be created with the provided unique key.
   *
   * Only used for Notification Tasks.
   */
  readonly unique?: Maybe<boolean | NotificationTaskUniqueId>;
  /**
   * Whether or not to override an existing task with the same unique key when creating.
   *
   * Defaults to false.
   *
   * Only used for Notification Tasks.
   */
  readonly overrideExistingTask?: Maybe<boolean>;
}

export interface CreateNotificationTemplateInput extends Partial<Omit<CreateNotificationTemplate, 'notificationModel'>>, Partial<Omit<CreateNotificationTemplateItem, 't' | 'cat'>> {
  /**
   * Model key input of the NotificationBox's target model (not the NotificationBox/key)
   */
  readonly notificationModel: ReadFirestoreModelKeyInput;
  /**
   * Template type
   */
  readonly type: NotificationTemplateType | NotificationTaskType;
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
  /**
   * Overrides ois
   */
  readonly explicitOptInSendOnly?: Maybe<boolean>;
  /**
   * Overrides ots
   */
  readonly explicitOptInTextSmsSendOnly?: Maybe<boolean>;
}

export function createNotificationTemplate(input: CreateNotificationTemplateInput): CreateNotificationTemplate {
  const {
    notificationModel: inputNotificationModel,
    type,
    unique,
    overrideExistingTask,
    // notification
    sendType,
    recipients,
    st,
    r,
    rf,
    sat,
    // task notifications
    tpr,
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
    ois: inputOis,
    ots: inputOts,
    explicitOptInSendOnly,
    explicitOptInTextSmsSendOnly,
    d: inputD
  } = input;

  const notificationModel = readFirestoreModelKey(inputNotificationModel) as string;
  const targetModel = inputTargetModel ? readFirestoreModelKey(inputTargetModel) : undefined;
  let d = data ?? inputD;

  if (d != null) {
    const filteredData = filterUndefinedValues(d, true); // filter both null and undefined values

    if (objectHasNoKeys(filteredData)) {
      d = undefined;
    } else {
      d = filteredData;
    }
  }

  const ois = explicitOptInSendOnly ?? inputOis ?? null;
  const ots = explicitOptInTextSmsSendOnly ?? inputOts ?? null;

  const template: CreateNotificationTemplate = {
    notificationModel,
    st: sendType ?? st,
    sat,
    tpr,
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
    },
    ois,
    ots,
    unique,
    overrideExistingTask
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
  readonly sendNotificationThrottleTime?: Maybe<Milliseconds>;
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
  const isNotThrottled = sendNotificationThrottleDate ? !isThrottled(sendNotificationThrottleTime, sendNotificationThrottleDate) : true;
  return sendNotification !== false && isNotThrottled;
}

export interface CreateNotificationDocumentPairInput extends ShouldSendCreatedNotificationInput {
  /**
   * Now to use when creating the notification.
   *
   * Default is the current time.
   */
  readonly now?: Maybe<Date>;
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

export interface CreateNotificationDocumentPairResult extends Pick<CreateNotificationTemplate, 'overrideExistingTask'> {
  readonly notificationDocument: NotificationDocument;
  readonly notification: Notification;
  /**
   * Whether or not the notification was created.
   */
  readonly notificationCreated: boolean;
  /**
   * Whether or not the notification is considered a task notification.
   */
  readonly isNotificationTask: boolean;
}

/**
 * Creates a CreateNotificationDocumentPairResult from the input.
 *
 * Only creates a pair. Used createNotificationDocument() to also save the document's data.
 *
 * @param template
 */
export function createNotificationDocumentPair(input: CreateNotificationDocumentPairInput): CreateNotificationDocumentPairResult {
  const { template, accessor: inputAccessor, transaction, context, now } = input;
  const { notificationModel, cat: inputCat, st, sat, r, rf, n, ts, es, ps, ns, ois, ots, tpr, unique: inputUnique, overrideExistingTask: inputOverrideExistingTask } = template;

  /**
   * Use the input, or default to true if inputUnique is true.
   */
  const overrideExistingTask = inputOverrideExistingTask != null ? inputOverrideExistingTask : inputUnique ? true : undefined;

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

  let notificationDocument: NotificationDocument;
  const isNotificationTask = st === NotificationSendType.TASK_NOTIFICATION;

  if (isNotificationTask && inputUnique) {
    let uniqueId: NotificationTaskUniqueId;

    if (typeof inputUnique === 'string') {
      uniqueId = inputUnique;

      if (!isFirestoreModelId(uniqueId)) {
        throw new Error('Input "unique" notification task id is not a valid firestore model id.');
      }
    } else {
      uniqueId = notificationTaskUniqueId(notificationModel, n.t);
    }

    notificationDocument = accessor.loadDocumentForId(uniqueId);
  } else {
    notificationDocument = accessor.newDocument();
  }

  const id = notificationDocument.id;
  const cat = inputCat ?? now ?? new Date();
  const notification: Notification = {
    cat,
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
    at: 0,
    d: false,
    tsr: [],
    esr: [],
    tpr: [],
    ois,
    ots,
    ts: ts ?? NotificationSendState.QUEUED,
    es: es ?? NotificationSendState.QUEUED,
    ps: ps ?? NotificationSendState.QUEUED,
    ns: ns ?? NotificationSendState.QUEUED,
    ut: inputUnique != null
  };

  if (isNotificationTask) {
    notification.tpr = tpr ?? []; // only set for task notifications
    // no recipients
    notification.r = [];
    // no send states
    notification.ts = NotificationSendState.NONE;
    notification.es = NotificationSendState.NONE;
    notification.ps = NotificationSendState.NONE;
    notification.ns = NotificationSendState.NONE;
  }

  return {
    notificationDocument,
    notification,
    isNotificationTask,
    overrideExistingTask,
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
  const { notification, notificationDocument, isNotificationTask, overrideExistingTask } = pair;

  if (input.shouldCreateNotification !== false && shouldSendCreatedNotificationInput(input)) {
    if (isNotificationTask && overrideExistingTask) {
      await notificationDocument.accessor.set(notification);
    } else {
      await notificationDocument.create(notification);
    }

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
