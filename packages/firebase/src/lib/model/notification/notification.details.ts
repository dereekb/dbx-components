import { type Maybe, multiValueMapBuilder, type ArrayOrValue, asArray } from '@dereekb/util';
import { type FirestoreCollectionType, type FirestoreModelIdentity, type ReadFirestoreModelKeyInput, firestoreModelKeyCollectionType, readFirestoreModelKey } from '../../common';
import { type NotificationTemplateType } from './notification.id';

/**
 * NotificationTemplateTypeInfoIdentityInfo alternative/derivative identity.
 *
 * For example, this model may be directly related to the identity in "notificationModelIdentity" but notifications are actually attached to the corresponding "altNotificationModelIdentity" or "altTargetModelIdentity".
 *
 * The alternative model should always have a NotificationBox associated with it.
 */
export interface NotificationTemplateTypeInfoIdentityInfoAlternativeModelIdentityPair {
  /**
   * Alternative notification model identity.
   */
  readonly altNotificationModelIdentity: FirestoreModelIdentity;
  /**
   * Corresponding alternative target model identity, if applicable.
   */
  readonly altTargetModelIdentity?: Maybe<FirestoreModelIdentity>;
}

/**
 * NotificationTemplateTypeInfo identity info
 */
export interface NotificationTemplateTypeInfoIdentityInfo {
  /**
   * Model identity that this notification is for.
   *
   * This model will have a NotificationBox associated with it if no alternativeNotificationModelIdentity values are provided.
   */
  readonly notificationModelIdentity: FirestoreModelIdentity;
  /**
   * Optional target model identity that this notification references.
   *
   * If not defined, it is assumed that the notificationModelIdentity is the target model.
   *
   * This model will not have a NotificationBox associated with it, and is typically a child model of the notificationModelIdentity.
   */
  readonly targetModelIdentity?: Maybe<FirestoreModelIdentity>;
  /**
   * One or more alternative/derivative model identities that this notification can target.
   */
  readonly alternativeModelIdentities?: Maybe<ArrayOrValue<NotificationTemplateTypeInfoIdentityInfoAlternativeModelIdentityPair>>;
  /**
   * Whether or not the system should expect to send notifications to the "notificationModelIdentity" if one or more "alternativeModelIdentities" values are provided.
   *
   * Defaults to false.
   */
  readonly sendToNotificationModelIdentity?: Maybe<boolean>;
}

/**
 * Template type identifier of the notification.
 *
 * Provides default information for the notification.
 *
 * Types are generally intended to be handled case-insensitively by notification services.
 */
export interface NotificationTemplateTypeInfo extends NotificationTemplateTypeInfoIdentityInfo {
  /**
   * Notification type
   */
  readonly type: NotificationTemplateType;
  /**
   * The notification's name
   */
  readonly name: string;
  /**
   * Description of the notification's content.
   */
  readonly description: string;
}

/**
 * Record of NotificationTemplateTypeInfo keyed by type.
 */
export type NotificationTemplateTypeInfoRecord = Record<NotificationTemplateType, NotificationTemplateTypeInfo>;

/**
 * Creates a NotificationTemplateTypeInfoRecord from the input details array.
 *
 * @param infoArray
 * @returns
 */
export function notificationTemplateTypeInfoRecord(infoArray: NotificationTemplateTypeInfo[]): NotificationTemplateTypeInfoRecord {
  const record: NotificationTemplateTypeInfoRecord = {};

  infoArray.forEach((x) => {
    const { type } = x;

    if (record[type]) {
      throw new Error(`notificationTemplateTypeInfoRecord(): duplicate NotificationTemplateType in record: ${type}`);
    }

    record[type] = x;
  });

  return record;
}

/**
 * Reference to a NotificationTemplateTypeInfoRecord that contains a AppNotificationTemplateTypeInfoRecordService
 */
export interface AppNotificationTemplateTypeInfoRecordServiceRef {
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
}

export abstract class AppNotificationTemplateTypeInfoRecordService {
  /**
   * All records for this app.
   */
  abstract readonly appNotificationTemplateTypeInfoRecord: NotificationTemplateTypeInfoRecord;

  /**
   * Returns the array of all known NotificationTemplateTypes
   */
  abstract getAllKnownTemplateTypes(): NotificationTemplateType[];

  /**
   * Returns the array of all known NotificationTemplateTypeInfo
   */
  abstract getAllKnownTemplateTypeInfo(): NotificationTemplateTypeInfo[];

  /**
   * Returns all individual FirestoreModelIdentity values that are associate with atleast one NotificationTemplateType.
   */
  abstract getAllNotificationModelIdentityValues(): FirestoreModelIdentity[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypesForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypeInfo that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypesInfoForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model identity.
   *
   * @param identity
   */
  abstract getTemplateTypesForTargetModelIdentity(identity: FirestoreModelIdentity): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypeInfo that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypeInfosForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[];

  /**
   * Returns all NotificationTemplateTypeInfo that are associate with the given model identity.
   *
   * @param identity
   */
  abstract getTemplateTypeInfosForTargetModelIdentity(identity: FirestoreModelIdentity): NotificationTemplateTypeInfo[];
}

export function appNotificationTemplateTypeInfoRecordService(appNotificationTemplateTypeInfoRecord: NotificationTemplateTypeInfoRecord): AppNotificationTemplateTypeInfoRecordService {
  const allNotificationModelIdentityValuesSet = new Set<FirestoreModelIdentity>();

  const notificationModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();
  const targetModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();

  const allKnownTemplateTypes: NotificationTemplateType[] = [];
  const allKnownTemplateTypeInfo: NotificationTemplateTypeInfo[] = [];

  Object.entries(appNotificationTemplateTypeInfoRecord).forEach(([_, details]) => {
    const { notificationModelIdentity, targetModelIdentity, alternativeModelIdentities } = details;

    function addInfoForIdentity(modelIdentity: FirestoreModelIdentity, targetIdentity?: Maybe<FirestoreModelIdentity>) {
      const { collectionType } = modelIdentity;

      notificationModelTypeInfoMapBuilder.add(collectionType, details);
      targetModelTypeInfoMapBuilder.add(targetIdentity?.collectionType ?? collectionType, details);

      allNotificationModelIdentityValuesSet.add(modelIdentity);
    }

    addInfoForIdentity(notificationModelIdentity, targetModelIdentity);

    if (alternativeModelIdentities != null) {
      asArray(alternativeModelIdentities).forEach((x) => {
        addInfoForIdentity(x.altNotificationModelIdentity, x.altTargetModelIdentity ?? targetModelIdentity);
      });
    }

    allKnownTemplateTypeInfo.push(details);
    allKnownTemplateTypes.push(details.type);
  });

  const allNotificationModelIdentityValues = Array.from(allNotificationModelIdentityValuesSet);

  const notificationModelTemplateInfoMap = notificationModelTypeInfoMapBuilder.map();
  const targetModelTemplateInfoMap = targetModelTypeInfoMapBuilder.map();

  const notificationModelTemplateTypesMap = new Map(Array.from(notificationModelTemplateInfoMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));
  const targetModelTemplateTypesMap = new Map(Array.from(targetModelTemplateInfoMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));

  const service: AppNotificationTemplateTypeInfoRecordService = {
    appNotificationTemplateTypeInfoRecord,

    getAllKnownTemplateTypes(): NotificationTemplateType[] {
      return allKnownTemplateTypes;
    },

    getAllKnownTemplateTypeInfo(): NotificationTemplateTypeInfo[] {
      return allKnownTemplateTypeInfo;
    },

    getAllNotificationModelIdentityValues(): FirestoreModelIdentity[] {
      return allNotificationModelIdentityValues;
    },

    getTemplateTypesForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateTypesMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesInfoForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateInfoMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateTypesMap.get(targetFirestoreCollectionType) ?? [];
    },

    getTemplateTypesForTargetModelIdentity(identity: FirestoreModelIdentity): NotificationTemplateType[] {
      return targetModelTemplateTypesMap.get(identity.collectionName) ?? [];
    },

    getTemplateTypeInfosForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateInfoMap.get(targetFirestoreCollectionType) ?? [];
    },

    getTemplateTypeInfosForTargetModelIdentity(identity: FirestoreModelIdentity): NotificationTemplateTypeInfo[] {
      return targetModelTemplateInfoMap.get(identity.collectionName) ?? [];
    }
  };

  return service;
}

// MARK: Compat
/**
 * @deprecated use notificationTemplateTypeInfoRecord instead.
 */
export const notificationTemplateTypeDetailsRecord = notificationTemplateTypeInfoRecord;
