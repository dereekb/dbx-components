import { ArrayOrValue, asArray, Configurable, filterKeysOnPOJOFunction, type Maybe } from '@dereekb/util';
import { type Notification, type NotificationBox, type NotificationBoxDocument, NotificationRecipientSendFlag, type NotificationSendFlags, NotificationSendState, NotificationUser } from './notification';
import { type NotificationUserNotificationBoxRecipientConfig, type NotificationBoxRecipient, NotificationBoxRecipientFlag, type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationBoxRecipientTemplateConfigRecord } from './notification.config';
import { type AppNotificationTemplateTypeInfoRecordService } from './notification.details';
import { type FirebaseAuthUserId, type FirestoreDocumentAccessor, type FirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey } from '../../common';
import { NotificationBoxId, notificationBoxIdForModel, NotificationId, NotificationBoxSendExclusionList, NotificationBoxSendExclusion } from './notification.id';

// MARK: NotificationUser
export interface EffectiveNotificationBoxRecipientConfigInput {
  readonly uid: FirebaseAuthUserId;
  readonly m?: FirestoreModelKey;
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  readonly gc: NotificationUserDefaultNotificationBoxRecipientConfig;
  readonly boxConfig: NotificationUserNotificationBoxRecipientConfig;
  readonly recipient?: Maybe<NotificationBoxRecipient>;
}

export function effectiveNotificationBoxRecipientConfig(input: EffectiveNotificationBoxRecipientConfigInput) {
  const { uid, m: inputM, appNotificationTemplateTypeInfoRecordService, gc, boxConfig: notificationUserNotificationBoxConfig, recipient } = input;

  const m = inputM ?? inferKeyFromTwoWayFlatFirestoreModelKey(notificationUserNotificationBoxConfig.nb);
  const applicableTemplateTypesForModel = appNotificationTemplateTypeInfoRecordService.getTemplateTypesForNotificationModel(m);
  const filterOnlyApplicableTemplateTypes = filterKeysOnPOJOFunction<NotificationBoxRecipientTemplateConfigRecord>(applicableTemplateTypesForModel);

  // retain only the relevant/applicable template types for the model associate with the notification box
  const c = filterOnlyApplicableTemplateTypes({
    ...recipient?.c,
    ...notificationUserNotificationBoxConfig.c,
    ...gc.c
  });

  const nextRecipient: NotificationBoxRecipient = {
    ...recipient,
    c,
    uid, // index and uid are retained
    i: recipient?.i ?? notificationUserNotificationBoxConfig.i,
    // copy from NotificationUser
    f: gc.f ?? notificationUserNotificationBoxConfig.f ?? recipient?.f,
    lk: gc.lk ?? notificationUserNotificationBoxConfig.lk, // lock state only comes from NotificationUser
    // email and text overrides first come from global, then the NotificationBox specific config
    e: gc.e ?? notificationUserNotificationBoxConfig.e,
    t: gc.t ?? notificationUserNotificationBoxConfig.t,
    // no custom name or notification summary allowed
    n: undefined,
    s: undefined, // should never be defined since uid is defined
    // always resync x
    x: notificationUserNotificationBoxConfig.x
  };

  return nextRecipient;
}

export interface UpdateNotificationUserNotificationSendExclusionsInput {
  readonly notificationUser: Pick<NotificationUser, 'b' | 'x' | 'bc'>;
  readonly addExclusions?: ArrayOrValue<NotificationBoxSendExclusion>;
  readonly removeExclusions?: ArrayOrValue<NotificationBoxSendExclusion>;
}

export interface UpdateNotificationUserNotificationSendExclusionsResult {
  readonly nextExclusions: NotificationBoxSendExclusionList;
  readonly update: Pick<NotificationUser, 'x' | 'ns' | 'bc'>;
}

export function updateNotificationUserNotificationSendExclusions(input: UpdateNotificationUserNotificationSendExclusionsInput): UpdateNotificationUserNotificationSendExclusionsResult {
  const { notificationUser, addExclusions: inputAddExclusions, removeExclusions: inputRemoveExclusions } = input;
  const { b: associatedNotificationBoxes, x: currentExclusions, bc: notificationBoxConfigs } = notificationUser;

  let addExclusions: NotificationBoxSendExclusionList = [];
  let removeExclusions: NotificationBoxSendExclusionList = [];

  if (inputAddExclusions) {
    addExclusions = asArray(inputAddExclusions);
  }

  if (inputRemoveExclusions) {
    removeExclusions = asArray(inputRemoveExclusions);
  }

  const removeExclusionsSet = new Set(removeExclusions);
  const initialNextExclusions = [...addExclusions, ...currentExclusions].filter((x) => !removeExclusionsSet.has(x));

  // verify each exclusion is related to atleast one notification box
  const nextExclusions = initialNextExclusions.filter((exclusion) => {
    const firstMatch = associatedNotificationBoxes.findIndex((x) => x.startsWith(exclusion));
    return firstMatch !== -1;
  });

  const update = applyExclusionsToNotificationUserNotificationBoxRecipientConfigs({
    x: nextExclusions,
    bc: notificationBoxConfigs,
    notificationUser,
    recalculateNs: true
  }) as Configurable<Pick<NotificationUser, 'x' | 'bc' | 'ns'>>;

  update.x = nextExclusions;

  return {
    nextExclusions,
    update
  };
}

export interface ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsParams {
  readonly x?: NotificationBoxSendExclusionList;
  readonly bc?: Maybe<NotificationUserNotificationBoxRecipientConfig[]>;
  readonly notificationUser?: Pick<NotificationUser, 'bc' | 'x'>;
  readonly recalculateNs?: boolean;
}

export type ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsResult = Pick<NotificationUser, 'bc' | 'ns'>;

export function applyExclusionsToNotificationUserNotificationBoxRecipientConfigs(params: ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsParams): ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsResult {
  const { x: inputX, bc: inputBc, notificationUser, recalculateNs } = params;

  const x = inputX ?? notificationUser?.x ?? [];
  const currentBc = inputBc ?? notificationUser?.bc ?? [];

  // test the new configs and update the exclusion and ns flags
  const canSendToNotificationBoxFunction = notificationSendExclusionCanSendFunction(x);

  const nextBc = currentBc.map((x) => {
    const currentNotificationBoxExcluded = Boolean(x.x);
    const isExcluded = !canSendToNotificationBoxFunction(x.nb); // excluded if cannot send

    let updatedConfig: NotificationUserNotificationBoxRecipientConfig = x;

    if (currentNotificationBoxExcluded !== isExcluded) {
      updatedConfig = {
        ...x,
        x: isExcluded,
        ns: true
      };
    }

    return updatedConfig;
  });

  const update: ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsResult = {
    bc: nextBc,
    ns: recalculateNs ? calculateNsForNotificationUserNotificationBoxRecipientConfigs(nextBc) : undefined
  };

  return update;
}

export function calculateNsForNotificationUserNotificationBoxRecipientConfigs(configs: NotificationUserNotificationBoxRecipientConfig[]): boolean {
  return configs.some((x) => x.ns);
}

/**
 * Function that returns true if the notification is not excluded from being sent.
 */
export type NotificationSendExclusionCanSendFunction = ((notification: NotificationId | NotificationBoxId) => boolean) & {
  readonly _exclusions: NotificationBoxSendExclusionList;
};

export const notificationSendExclusionCanSendFunction = (exclusions: NotificationBoxSendExclusionList): NotificationSendExclusionCanSendFunction => {
  const fn = (notification: NotificationId | NotificationBoxId) => {
    return exclusions.findIndex((x) => notification.startsWith(x)) === -1;
  };

  fn._exclusions = exclusions;

  return fn;
};

// MARK: Notification
/**
 * Returns true if the notification's send types are all marked as sent.
 *
 * @param input
 * @returns
 */
export function notificationSendFlagsImplyIsComplete(input: NotificationSendFlags): boolean {
  return isCompleteNotificationSendState(input.es) && isCompleteNotificationSendState(input.ps) && isCompleteNotificationSendState(input.ts) && isCompleteNotificationSendState(input.ns);
}

/**
 * Returns true if the state implies completion of sending (not necessarily success, but that attempts to send are done)
 *
 * @param input
 * @returns
 */
export function isCompleteNotificationSendState(input: NotificationSendState): boolean {
  let isComplete = false;

  switch (input) {
    case NotificationSendState.NONE:
    case NotificationSendState.NO_TRY:
    case NotificationSendState.SENT:
    case NotificationSendState.SKIPPED:
      isComplete = true;
      break;
    default:
      isComplete = false;
      break;
  }

  return isComplete;
}

export interface AllowedNotificationRecipients {
  readonly canSendToGlobalRecipients: boolean;
  readonly canSendToBoxRecipients: boolean;
  readonly canSendToExplicitRecipients: boolean;
}

/**
 * Returns a AllowedNotificationRecipients from the input NotificationRecipientSendFlag.
 *
 * @param flag
 * @returns
 */
export function allowedNotificationRecipients(flag?: Maybe<NotificationRecipientSendFlag>): AllowedNotificationRecipients {
  let canSendToGlobalRecipients: boolean = true;
  let canSendToBoxRecipients: boolean = true;
  let canSendToExplicitRecipients: boolean = true;

  switch (flag) {
    case NotificationRecipientSendFlag.SKIP_NOTIFICATION_BOX_RECIPIENTS:
      canSendToBoxRecipients = false;
      break;
    case NotificationRecipientSendFlag.SKIP_GLOBAL_RECIPIENTS:
      canSendToGlobalRecipients = false;
      break;
    case NotificationRecipientSendFlag.ONLY_EXPLICIT_RECIPIENTS:
      canSendToBoxRecipients = false;
      canSendToGlobalRecipients = false;
      break;
    case NotificationRecipientSendFlag.ONLY_GLOBAL_RECIPIENTS:
      canSendToBoxRecipients = false;
      canSendToExplicitRecipients = false;
      break;
    case NotificationRecipientSendFlag.NORMAL:
    default:
      // all true
      break;
  }

  return {
    canSendToGlobalRecipients,
    canSendToBoxRecipients,
    canSendToExplicitRecipients
  };
}

// MARK: NotificationWeek
/**
 * Whether or not the Notification should be saved to the NotificationWeek.
 *
 * A Notification should only be saved when the notification can be sent to box recipients.
 *
 * @param notification
 * @returns
 */
export function shouldSaveNotificationToNotificationWeek(notification: Notification): boolean {
  return allowedNotificationRecipients(notification.rf).canSendToBoxRecipients;
}

// MARK: NotificationBox
export function mergeNotificationUserNotificationBoxRecipientConfigs(a: NotificationUserNotificationBoxRecipientConfig, b: Partial<NotificationUserNotificationBoxRecipientConfig>): NotificationUserNotificationBoxRecipientConfig {
  return {
    ...mergeNotificationBoxRecipients(a, b),
    // retain the following states always
    f: a.f === NotificationBoxRecipientFlag.OPT_OUT ? a.f : (b.f ?? a.f), // do not override if marked OPT OUT
    nb: a.nb,
    rm: a.rm,
    ns: a.ns,
    lk: a.lk,
    bk: a.bk
  };
}

export function mergeNotificationBoxRecipients<T extends NotificationBoxRecipient>(a: T, b: Partial<T>): T {
  return {
    ...a,
    ...b,
    // configs should be merged/ovewritten
    c: {
      ...a.c,
      ...b.c
    }
  };
}

// MARK: NotificationBox
export interface NotificationBoxDocumentReferencePair {
  /**
   * NotificationBoxDocument to update.
   *
   * If not provided, please provide the notificationBoxRelatedModelKey. If neither value is provided, an error will be thrown.
   */
  readonly notificationBoxDocument?: Maybe<NotificationBoxDocument>;
  /**
   * Key of the model the notification box is expected to be associated with. Used if NotificationBoxDocument is not provided already.
   */
  readonly notificationBoxRelatedModelKey?: Maybe<FirestoreModelKey>;
}

export function loadNotificationBoxDocumentForReferencePair(input: NotificationBoxDocumentReferencePair, accessor: FirestoreDocumentAccessor<NotificationBox, NotificationBoxDocument>) {
  const { notificationBoxDocument: inputNotificationBoxDocument, notificationBoxRelatedModelKey: inputNotificationBoxRelatedModelKey } = input;
  let notificationBoxDocument: NotificationBoxDocument;

  if (inputNotificationBoxDocument != null) {
    notificationBoxDocument = inputNotificationBoxDocument;
  } else if (inputNotificationBoxRelatedModelKey) {
    const notificationBoxId = notificationBoxIdForModel(inputNotificationBoxRelatedModelKey);
    notificationBoxDocument = accessor.loadDocumentForId(notificationBoxId);
  } else {
    throw new Error('NotificationBoxDocument or NotificationBoxRelatedModelKey is required');
  }

  return notificationBoxDocument;
}
