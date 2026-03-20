/**
 * @module notification.util
 *
 * Server-side utility functions for notification config resolution, exclusion management,
 * send state evaluation, and recipient merging.
 */
import { type ArrayOrValue, asArray, type Configurable, filterKeysOnPOJOFunction, type Maybe } from '@dereekb/util';
import { type Notification, type NotificationBox, type NotificationBoxDocument, NotificationRecipientSendFlag, type NotificationSendFlags, NotificationSendState, type NotificationUser } from './notification';
import { type NotificationUserNotificationBoxRecipientConfig, type NotificationBoxRecipient, NotificationBoxRecipientFlag, type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationBoxRecipientTemplateConfigRecord } from './notification.config';
import { type AppNotificationTemplateTypeInfoRecordService } from './notification.details';
import { type FirebaseAuthUserId, type FirestoreDocumentAccessor, type FirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey } from '../../common';
import { type NotificationBoxId, notificationBoxIdForModel, type NotificationId, type NotificationBoxSendExclusionList, type NotificationBoxSendExclusion } from './notification.id';

// MARK: NotificationUser
/**
 * Input for computing the effective {@link NotificationBoxRecipient} by merging the 3-level config hierarchy:
 * recipient entry → user's per-box config → user's global config.
 */
export interface EffectiveNotificationBoxRecipientConfigInput {
  readonly uid: FirebaseAuthUserId;
  readonly m?: FirestoreModelKey;
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  readonly gc: NotificationUserDefaultNotificationBoxRecipientConfig;
  readonly boxConfig: NotificationUserNotificationBoxRecipientConfig;
  readonly recipient?: Maybe<NotificationBoxRecipient>;
}

/**
 * Computes the effective {@link NotificationBoxRecipient} by merging configs from highest to lowest priority:
 * global config (`gc`) → per-box user config (`boxConfig`) → existing box recipient.
 *
 * Filters template configs to only include types applicable to the notification box's model.
 * Used during the server-side sync process to update box recipient entries from user configs.
 *
 * @param input - the merged config inputs including uid, global config, box config, and optional existing recipient
 * @returns the computed effective box recipient with merged config, contact info, and flags
 */
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

/**
 * Input for adding/removing send exclusions on a {@link NotificationUser}.
 */
export interface UpdateNotificationUserNotificationSendExclusionsInput {
  readonly notificationUser: Pick<NotificationUser, 'b' | 'x' | 'bc'>;
  readonly addExclusions?: ArrayOrValue<NotificationBoxSendExclusion>;
  readonly removeExclusions?: ArrayOrValue<NotificationBoxSendExclusion>;
}

export interface UpdateNotificationUserNotificationSendExclusionsResult {
  readonly nextExclusions: NotificationBoxSendExclusionList;
  readonly update: Pick<NotificationUser, 'x' | 'ns' | 'bc'>;
}

/**
 * Adds and/or removes send exclusions from a {@link NotificationUser}, validates them against associated boxes,
 * and propagates exclusion flags to the per-box configs.
 *
 * Exclusions not matching any associated notification box are automatically filtered out.
 *
 * @param input - the user, exclusions to add, and exclusions to remove
 * @returns the updated exclusion list and the partial user update to apply
 */
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

/**
 * Input for applying exclusion flags to per-box configs, updating the `x` and `ns` fields on each config.
 */
export interface ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsParams {
  readonly x?: NotificationBoxSendExclusionList;
  readonly bc?: Maybe<NotificationUserNotificationBoxRecipientConfig[]>;
  readonly notificationUser?: Pick<NotificationUser, 'bc' | 'x'>;
  readonly recalculateNs?: boolean;
}

export type ApplyExclusionsToNotificationUserNotificationBoxRecipientConfigsResult = Pick<NotificationUser, 'bc' | 'ns'>;

/**
 * Applies the current exclusion list to per-box configs, setting/clearing the `x` flag and marking
 * changed configs as needing sync (`ns = true`).
 *
 * @param params - the exclusion list, per-box configs, and optional flag to recalculate the global ns flag
 * @returns the updated per-box configs and the recalculated needs-sync flag
 */
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

/**
 * Returns true if any of the per-box configs need syncing (`ns == true`).
 *
 * @param configs - array of per-box recipient configs to check
 * @returns true if at least one config has its needs-sync flag set
 */
export function calculateNsForNotificationUserNotificationBoxRecipientConfigs(configs: NotificationUserNotificationBoxRecipientConfig[]): boolean {
  return configs.some((x) => x.ns);
}

/**
 * Predicate function that returns true if the given notification/box ID is NOT excluded from delivery.
 * Uses prefix matching against the exclusion list.
 */
export type NotificationSendExclusionCanSendFunction = ((notification: NotificationId | NotificationBoxId) => boolean) & {
  readonly _exclusions: NotificationBoxSendExclusionList;
};

/**
 * Creates a {@link NotificationSendExclusionCanSendFunction} from the given exclusion list.
 * Returns true for IDs that don't match any exclusion prefix.
 *
 * @param exclusions - the list of box IDs or prefixes that should be excluded from delivery
 * @returns a predicate function that returns true if the given notification/box ID is not excluded
 */
export const notificationSendExclusionCanSendFunction = (exclusions: NotificationBoxSendExclusionList): NotificationSendExclusionCanSendFunction => {
  const fn = (notification: NotificationId | NotificationBoxId) => {
    return !exclusions.some((x) => notification.startsWith(x));
  };

  fn._exclusions = exclusions;

  return fn;
};

// MARK: Notification
/**
 * Returns true if all channels on the notification have reached a terminal state
 * (NONE, NO_TRY, SENT, or SKIPPED). Used to determine if the notification can be marked done.
 *
 * @param input - the per-channel send flags to evaluate
 * @returns true if all channels are in a terminal send state
 */
export function notificationSendFlagsImplyIsComplete(input: NotificationSendFlags): boolean {
  return isCompleteNotificationSendState(input.es) && isCompleteNotificationSendState(input.ps) && isCompleteNotificationSendState(input.ts) && isCompleteNotificationSendState(input.ns);
}

/**
 * Returns true if the given send state is terminal — no further send attempts will be made.
 * Terminal states: NONE, NO_TRY, SENT, SKIPPED.
 *
 * @param input - the send state to evaluate
 * @returns true if the state is terminal and no further delivery will be attempted
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
    case NotificationSendState.QUEUED:
    case NotificationSendState.SENT_PARTIAL:
    case NotificationSendState.SEND_ERROR:
    case NotificationSendState.BUILD_ERROR:
    case NotificationSendState.CONFIG_ERROR:
      isComplete = false;
      break;
  }

  return isComplete;
}

/**
 * Resolved recipient group flags based on a {@link NotificationRecipientSendFlag}.
 */
export interface AllowedNotificationRecipients {
  readonly canSendToGlobalRecipients: boolean;
  readonly canSendToBoxRecipients: boolean;
  readonly canSendToExplicitRecipients: boolean;
}

/**
 * Resolves which recipient groups (global, box, explicit) are allowed based on the {@link NotificationRecipientSendFlag}.
 *
 * @param flag - the recipient send flag controlling which groups are included
 * @returns an object indicating which recipient groups are permitted for this notification
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
    case undefined:
    case null:
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
 * Returns true if the notification should be archived to a {@link NotificationWeek} after delivery.
 *
 * Only notifications that can be sent to box recipients are archived (notifications restricted
 * to only explicit or only global recipients are not saved to the weekly archive).
 *
 * @param notification - the notification to check
 * @returns true if the notification should be saved to the weekly archive after delivery
 */
export function shouldSaveNotificationToNotificationWeek(notification: Notification): boolean {
  return allowedNotificationRecipients(notification.rf).canSendToBoxRecipients;
}

// MARK: NotificationBox
/**
 * Merges a partial update into a {@link NotificationUserNotificationBoxRecipientConfig},
 * preserving user-controlled fields (`nb`, `rm`, `ns`, `lk`, `bk`) and respecting OPT_OUT state.
 *
 * @param a - base user box recipient config to merge into
 * @param b - partial update to apply on top of the base
 * @returns the merged config with protected fields retained from `a`
 */
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

/**
 * Merges a partial update into a {@link NotificationBoxRecipient}, deeply merging the `c` (config record) field.
 *
 * @param a - base recipient to merge into
 * @param b - partial recipient update to apply on top of the base
 * @returns the merged recipient with deeply merged template config records
 */
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

// MARK: NotificationBox Reference
/**
 * Input for resolving a {@link NotificationBoxDocument}, either directly or by computing its ID from a model key.
 */
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

/**
 * Resolves a {@link NotificationBoxDocument} from a reference pair, loading by model key if no document is provided directly.
 *
 * @param input - reference pair containing either a direct document or a model key to load from
 * @param accessor - Firestore document accessor used to load the document by ID when needed
 * @returns the resolved NotificationBoxDocument
 * @throws {Error} When neither a document nor a model key is provided.
 */
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
