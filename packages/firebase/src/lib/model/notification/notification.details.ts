import { type Maybe, multiValueMapBuilder } from '@dereekb/util';
import { type FirestoreCollectionType, type FirestoreModelIdentity, type ReadFirestoreModelKeyInput, firestoreModelKeyCollectionType, readFirestoreModelKey } from '../../common';
import { type NotificationTemplateType } from './notification.id';

/**
 * Template type identifier of the notification.
 *
 * Provides default information for the notification.
 *
 * Types are generally intended to be handled case-insensitively by notification services.
 */
export interface NotificationTemplateTypeInfo {
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
  /**
   * Model identity that this notification is for.
   *
   * This model will have a NotificationBox associated with it.
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
export function notificationTemplateTypeDetailsRecord(infoArray: NotificationTemplateTypeInfo[]): NotificationTemplateTypeInfoRecord {
  const record: NotificationTemplateTypeInfoRecord = {};

  infoArray.forEach((x) => {
    const { type } = x;

    if (record[type]) {
      throw new Error(`notificationTemplateTypeDetailsRecord(): duplicate NotificationTemplateType in record: ${type}`);
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
  abstract getAllKnownTemplateTypeDetails(): NotificationTemplateTypeInfo[];

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
  abstract getTemplateTypesDetailsForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypeInfo that are associate with the given model input.
   *
   * @param model
   */
  abstract getTemplateTypesDetailsForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[];
}

export function appNotificationTemplateTypeInfoRecordService(appNotificationTemplateTypeInfoRecord: NotificationTemplateTypeInfoRecord): AppNotificationTemplateTypeInfoRecordService {
  const allNotificationModelIdentityValuesSet = new Set<FirestoreModelIdentity>();

  const notificationModelTypeDetailsMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();
  const targetModelTypeDetailsMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();

  const allKnownTemplateTypes: NotificationTemplateType[] = [];
  const allKnownTemplateTypeDetails: NotificationTemplateTypeInfo[] = [];

  Object.entries(appNotificationTemplateTypeInfoRecord).forEach(([_, details]) => {
    const { collectionType } = details.notificationModelIdentity;

    notificationModelTypeDetailsMapBuilder.add(collectionType, details);
    targetModelTypeDetailsMapBuilder.add(details.targetModelIdentity?.collectionType ?? collectionType, details);

    allNotificationModelIdentityValuesSet.add(details.notificationModelIdentity);
    allKnownTemplateTypeDetails.push(details);
    allKnownTemplateTypes.push(details.type);
  });

  const allNotificationModelIdentityValues = Array.from(allNotificationModelIdentityValuesSet);

  const notificationModelTemplateDetailsMap = notificationModelTypeDetailsMapBuilder.map();
  const targetModelTemplateDetailsMap = targetModelTypeDetailsMapBuilder.map();

  const notificationModelTemplateTypesMap = new Map(Array.from(notificationModelTemplateDetailsMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));
  const targetModelTemplateTypesMap = new Map(Array.from(targetModelTemplateDetailsMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));

  const service: AppNotificationTemplateTypeInfoRecordService = {
    appNotificationTemplateTypeInfoRecord,

    getAllKnownTemplateTypes(): NotificationTemplateType[] {
      return allKnownTemplateTypes;
    },

    getAllKnownTemplateTypeDetails(): NotificationTemplateTypeInfo[] {
      return allKnownTemplateTypeDetails;
    },

    getAllNotificationModelIdentityValues(): FirestoreModelIdentity[] {
      return allNotificationModelIdentityValues;
    },

    getTemplateTypesForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateTypesMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesDetailsForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateDetailsMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateTypesMap.get(targetFirestoreCollectionType) ?? [];
    },

    getTemplateTypesDetailsForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeInfo[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateDetailsMap.get(targetFirestoreCollectionType) ?? [];
    }
  };

  return service;
}
