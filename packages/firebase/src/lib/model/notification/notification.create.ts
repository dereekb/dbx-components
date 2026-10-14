/**
 * @module notification.create
 *
 * Factory functions and template types for creating {@link Notification} documents.
 *
 * Provides a fluent input pattern ({@link CreateNotificationTemplateInput}) that maps friendly field names
 * to the abbreviated Firestore fields, plus throttling support to avoid duplicate sends.
 */
import { type Building, type Maybe, type Milliseconds, type ModelKey, MS_IN_HOUR, objectHasNoKeys, filterUndefinedValues, isThrottled } from '@dereekb/util';
import { type Notification, type NotificationDocument, type NotificationFirestoreCollections, notificationBoxIdentity, notificationIdentity, NotificationSendState, NotificationSendType } from './notification';
import { type NotificationRecipientWithConfig } from './notification.config';
import { DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY, notificationBoxIdForModel, type NotificationTaskKey, type NotificationTaskType, notificationTaskUniqueId, type NotificationTaskUniqueId, type NotificationTemplateType } from './notification.id';
import { childFirestoreModelKey, type FirebaseAuthUserId, type FirestoreDocumentAccessor, firestoreModelKey, type FirestoreModelKey, type ReadFirestoreModelKeyInput, type Transaction, isFirestoreModelId, readFirestoreModelKey } from '../../common';
import { type NotificationItem } from './notification.item';

/**
 * Template for the embedded {@link NotificationItem} within a new notification.
 * Omits auto-generated fields (`id`, `cat`) that are set during document creation.
 */
export interface CreateNotificationTemplateItem extends Omit<NotificationItem, 'r' | 'id' | 'cat'> {
  /**
   * Custom created at date for the item.
   */
  readonly cat?: Maybe<Date>;
}

/**
 * Low-level template for creating a new {@link Notification} document. Uses Firestore field abbreviations directly.
 *
 * Prefer using {@link CreateNotificationTemplateInput} with {@link createNotificationTemplate} for a friendlier API.
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

/**
 * Friendly input type for creating notification templates. Maps readable field names to the abbreviated Firestore fields.
 *
 * Processed by {@link createNotificationTemplate} into a {@link CreateNotificationTemplate}.
 *
 * @example
 * ```ts
 * const template = createNotificationTemplate({
 *   notificationModel: 'project/abc123',
 *   type: 'comment',
 *   subject: 'New comment',
 *   message: 'Someone commented on your project',
 *   createdBy: 'user-uid-123'
 * });
 * ```
 */
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

/**
 * Converts a {@link CreateNotificationTemplateInput} into a {@link CreateNotificationTemplate}
 * ready for document creation.
 *
 * Maps friendly field names (`subject`, `message`, `createdBy`, etc.) to their Firestore abbreviations
 * and filters out null/undefined metadata values.
 *
 * @param input - Friendly input with readable field names.
 * @returns The low-level template using Firestore field abbreviations.
 *
 * @__NO_SIDE_EFFECTS__
 */
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

// MARK: Unique Task Key
/**
 * Input for {@link uniqueNotificationTaskKey}.
 */
export interface UniqueNotificationTaskKeyInput {
  /**
   * Model whose notification box holds the task.
   *
   * Defaults to {@link DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY}, the same default {@link createNotificationTaskTemplate} applies.
   */
  readonly notificationModel?: Maybe<FirestoreModelKey>;
  /**
   * Unique id of the task within its notification box.
   */
  readonly uniqueId: NotificationTaskUniqueId;
}

/**
 * Returns the key of a unique notification task: the notification with the unique id in the notification model's box.
 *
 * This is the location {@link createNotificationDocumentPair} loads a unique task from when its accessor comes from `context`, so a key recorded with this function always points at the created task.
 *
 * @param input - The notification model and the unique task id.
 * @returns The full key of the unique notification task.
 *
 * @dbxUtil
 * @dbxUtilCategory firestore
 * @dbxUtilTags notification, task, unique, key, notification-box, location
 * @dbxUtilRelated form-space-submission-notification-task-key
 *
 * @example
 * ```ts
 * uniqueNotificationTaskKey({ notificationModel: 'profile/abc', uniqueId: 'abc_T' }); // 'nb/profile_abc/nbn/abc_T'
 * uniqueNotificationTaskKey({ uniqueId: 'abc_T' }); // 'nb/not_not/nbn/abc_T'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function uniqueNotificationTaskKey(input: UniqueNotificationTaskKeyInput): NotificationTaskKey {
  const notificationModel = input.notificationModel ?? DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY;
  const notificationBoxKey = firestoreModelKey(notificationBoxIdentity, notificationBoxIdForModel(notificationModel));
  return childFirestoreModelKey(notificationBoxKey, notificationIdentity, input.uniqueId);
}

// MARK: Create
/**
 * Input parameters controlling whether a notification should actually be created and sent.
 *
 * Supports both an explicit toggle (`sendNotification`) and time-based throttling
 * to prevent duplicate sends within a configurable window.
 */
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
 * Determines whether a notification should be created based on the explicit toggle and throttle settings.
 *
 * Returns false if `sendNotification` is explicitly false, or if the throttle window hasn't elapsed.
 *
 * @param input - The send control parameters including the toggle and throttle configuration.
 * @returns True if the notification should be created and sent.
 */
export function shouldSendCreatedNotificationInput(input: ShouldSendCreatedNotificationInput): boolean {
  const { sendNotification, sendNotificationThrottleDate, sendNotificationThrottleTime: inputSendNotificationThrottleTime } = input;
  const sendNotificationThrottleTime: Milliseconds = inputSendNotificationThrottleTime ?? MS_IN_HOUR;
  const isNotThrottled = sendNotificationThrottleDate ? !isThrottled(sendNotificationThrottleTime, sendNotificationThrottleDate) : true;
  return sendNotification !== false && isNotThrottled;
}

/**
 * Full input for creating a {@link Notification} document, including the template, transaction context,
 * and collection accessors.
 */
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

/**
 * Result of creating a notification document pair (document reference + data), before or after saving.
 */
export interface CreateNotificationDocumentPairResult extends Pick<CreateNotificationTemplate, 'overrideExistingTask'> {
  /**
   * The notification document.
   */
  readonly notificationDocument: NotificationDocument;
  /**
   * The notification data.
   */
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
 * Creates a notification document reference and builds the {@link Notification} data, but does NOT save to Firestore.
 *
 * Use {@link createNotificationDocument} to both create and save in one step.
 *
 * For unique task notifications, generates a deterministic document ID from the target model and task type. When the accessor comes from `context`, a unique task is loaded at {@link uniqueNotificationTaskKey}.
 *
 * @param input - The creation parameters including template, context, and accessor.
 * @returns The document reference and notification data pair, with `notificationCreated` set to false.
 * @throws {Error} When neither an accessor nor sufficient context is provided.
 * @throws {Error} When `unique=true` but no target model is specified.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createNotificationDocumentPair(input: CreateNotificationDocumentPairInput): CreateNotificationDocumentPairResult {
  const { template, accessor: inputAccessor, transaction, context, now } = input;
  const { notificationModel, cat: inputCat, st, sat, r, rf, n, ts, es, ps, ns, ois, ots, tpr, unique: inputUnique, overrideExistingTask: inputOverrideExistingTask } = template;

  /**
   * Use the input, or default to true if inputUnique is true.
   */
  const overrideExistingTask = inputOverrideExistingTask ?? (inputUnique ? true : undefined);

  let accessor = inputAccessor;
  const notificationBoxId = notificationBoxIdForModel(notificationModel);

  if (!accessor && notificationBoxId && context) {
    const { notificationCollectionFactory, notificationBoxCollection } = context;
    const notificationBoxDocument = notificationBoxCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationBoxId);
    accessor = notificationCollectionFactory(notificationBoxDocument).documentAccessorForTransaction(transaction);
  }

  if (!accessor) {
    throw new Error('createNotificationDocument() failed as neither an accessor nor sufficient information was provided about the target.');
  }

  let notificationDocument: NotificationDocument;
  const isNotificationTask = st === NotificationSendType.TASK_NOTIFICATION;
  const isLoggedEvent = st === NotificationSendType.LOGGED_EVENT;

  if (isNotificationTask && inputUnique) {
    let uniqueId: NotificationTaskUniqueId;

    /**
     * Defaults to the notification box id if no target model is provided.
     */
    const targetModelId = n.m;

    if (typeof inputUnique === 'string') {
      uniqueId = inputUnique;

      if (!isFirestoreModelId(uniqueId)) {
        throw new Error('Input "unique" notification task id is not a valid firestore model id.');
      }
    } else if (targetModelId) {
      uniqueId = notificationTaskUniqueId(targetModelId, n.t);
    } else {
      // Without a target model, the generated id ends up being a type-global unique notification task id, or if
      // the notification task global default model type is used, being unique across the whole system, which is
      // generally unintended behavor. When it is desired, the inputUnique can be a string.
      throw new Error('Must provide a target model when using unique=true for a notification task. The default result otherwise would be an unintended type-global unique notification task id.');
    }

    // An explicit accessor chooses the collection itself. Otherwise the task is loaded from uniqueNotificationTaskKey(), the
    // key NotificationTaskBot records for its runs, so a recorded key and the created document cannot drift apart.
    notificationDocument = inputAccessor ? inputAccessor.loadDocumentForId(uniqueId) : accessor.loadDocumentForKey(uniqueNotificationTaskKey({ notificationModel, uniqueId }));
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
  } else if (isLoggedEvent) {
    // logged events are persisted as write-only records: marked done immediately so the send loop never visits them.
    notification.r = [];
    notification.d = true;
    notification.ts = NotificationSendState.NO_TRY;
    notification.es = NotificationSendState.NO_TRY;
    notification.ps = NotificationSendState.NO_TRY;
    notification.ns = NotificationSendState.NO_TRY;
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
 * Internal function used by createNotificationDocument().
 *
 * @param input - Send control parameters (throttle settings, shouldCreateNotification flag)
 * @param pair - The document pair created by {@link createNotificationDocumentPair}
 * @returns The pair with `notificationCreated` updated to reflect whether the document was saved.
 */
export async function _createNotificationDocumentFromPair(input: Pick<CreateNotificationDocumentPairInput, 'shouldCreateNotification' | keyof ShouldSendCreatedNotificationInput>, pair: CreateNotificationDocumentPairResult): Promise<CreateNotificationDocumentPairResult> {
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
 * Creates a new {@link Notification} document and saves it to Firestore.
 *
 * For unique tasks with `overrideExistingTask`, uses `set()` to replace existing documents.
 * Otherwise uses `create()` which fails if the document already exists.
 *
 * @param input - The creation parameters including template, context, send control settings.
 * @returns The document pair with `notificationCreated` reflecting whether the document was saved.
 */
export async function createNotificationDocument(input: CreateNotificationDocumentPairInput): Promise<CreateNotificationDocumentPairResult> {
  const pair = createNotificationDocumentPair(input);
  return _createNotificationDocumentFromPair(input, pair);
}

/**
 * Creates and saves a notification only if sending conditions are met (not throttled, not explicitly disabled).
 *
 * Returns `undefined` if the notification was not created.
 *
 * @param input - The creation parameters including template, context, and send control settings.
 * @returns The document pair if the notification was created, or undefined if it was skipped.
 */
export async function createNotificationDocumentIfSending(input: CreateNotificationDocumentPairInput): Promise<Maybe<CreateNotificationDocumentPairResult>> {
  const pair = await createNotificationDocument(input);

  return pair.notificationCreated ? pair : undefined;
}
