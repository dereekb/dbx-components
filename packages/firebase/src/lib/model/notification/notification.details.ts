import { Maybe, arrayToObject, multiValueMapBuilder, objectToTuples } from '@dereekb/util';
import { FirestoreCollectionType, FirestoreModelIdentity, ReadFirestoreModelKeyInput, firestoreModelKeyCollectionType, readFirestoreModelKey } from '../../common';
import { NotificationTemplateType } from './notification.id';

/**
 * Template type identifier of the notification.
 *
 * Provides default information for the notification.
 *
 * Types are generally intended to be handled case-insensitively by notification services.
 */
export interface NotificationTemplateTypeDetails {
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
 * Record of NotificationTemplateTypeDetails keyed by type.
 */
export type NotificationTemplateTypeDetailsRecord = Record<NotificationTemplateType, NotificationTemplateTypeDetails>;

/**
 * Creates a NotificationTemplateTypeDetailsRecord from the input details array.
 *
 * @param details
 * @returns
 */
export function notificationTemplateTypeDetailsRecord(details: NotificationTemplateTypeDetails[]): NotificationTemplateTypeDetailsRecord {
  return arrayToObject(
    details,
    (d) => d.type,
    (d) => d
  );
}

/**
 * Reference to a NotificationTemplateTypeDetailsRecord that contains a AppNotificationTemplateTypeDetailsRecordService
 */
export interface AppNotificationTemplateTypeDetailsRecordServiceRef {
  readonly appNotificationTemplateTypeDetailsRecordService: AppNotificationTemplateTypeDetailsRecordService;
}

export interface AppNotificationTemplateTypeDetailsRecordService {

  /**
   * All records for this app.
   */
  readonly appNotificationTemplateTypeDetailsRecord: NotificationTemplateTypeDetailsRecord;

  /**
   * Returns all individual FirestoreModelIdentity values that are associate with atleast one NotificationTemplateType.
   */
  getAllNotificationModelIdentityValues(): FirestoreModelIdentity[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model input.
   * 
   * @param model 
   */
  getTemplateTypesForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypeDetails that are associate with the given model input. 
   * 
   * @param model 
   */
  getTemplateTypesDetailsForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeDetails[];

  /**
   * Returns all NotificationTemplateTypes that are associate with the given model input.
   * 
   * @param model 
   */
  getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[];

  /**
   * Returns all NotificationTemplateTypeDetails that are associate with the given model input. 
   * 
   * @param model 
   */
  getTemplateTypesDetailsForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeDetails[];

}

export function appNotificationTemplateTypeDetailsRecordService(appNotificationTemplateTypeDetailsRecord: NotificationTemplateTypeDetailsRecord): AppNotificationTemplateTypeDetailsRecordService {

  const allNotificationModelIdentityValuesSet = new Set<FirestoreModelIdentity>();
  const notificationModelTypeDetailsMapBuilder = multiValueMapBuilder<NotificationTemplateTypeDetails, FirestoreCollectionType>();
  const targetModelTypeDetailsMapBuilder = multiValueMapBuilder<NotificationTemplateTypeDetails, FirestoreCollectionType>();

  Object.entries(appNotificationTemplateTypeDetailsRecord).forEach(([_, details]) => {
    const { collectionType } = details.notificationModelIdentity;

    notificationModelTypeDetailsMapBuilder.add(collectionType, details);
    targetModelTypeDetailsMapBuilder.add(details.targetModelIdentity?.collectionType ?? collectionType, details);

    allNotificationModelIdentityValuesSet.add(details.notificationModelIdentity);
  });

  const allNotificationModelIdentityValues = Array.from(allNotificationModelIdentityValuesSet);

  const notificationModelTemplateDetailsMap = notificationModelTypeDetailsMapBuilder.map();
  const targetModelTemplateDetailsMap = targetModelTypeDetailsMapBuilder.map();

  const notificationModelTemplateTypesMap = new Map(Array.from(notificationModelTemplateDetailsMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));
  const targetModelTemplateTypesMap = new Map(Array.from(targetModelTemplateDetailsMap.entries()).map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));

  const service: AppNotificationTemplateTypeDetailsRecordService = {
    appNotificationTemplateTypeDetailsRecord,

    getAllNotificationModelIdentityValues(): FirestoreModelIdentity[] {
      return allNotificationModelIdentityValues;
    },

    getTemplateTypesForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateTypesMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesDetailsForNotificationModel(model: ReadFirestoreModelKeyInput): NotificationTemplateTypeDetails[] {
      const modelKey = readFirestoreModelKey(model, true);
      const firestoreCollectionType = firestoreModelKeyCollectionType(modelKey) as FirestoreCollectionType;
      return notificationModelTemplateDetailsMap.get(firestoreCollectionType) ?? [];
    },

    getTemplateTypesForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateType[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateTypesMap.get(targetFirestoreCollectionType) ?? [];
    },

    getTemplateTypesDetailsForTargetModel(target: ReadFirestoreModelKeyInput): NotificationTemplateTypeDetails[] {
      const targetModelKey = readFirestoreModelKey(target, true);
      const targetFirestoreCollectionType = firestoreModelKeyCollectionType(targetModelKey) as FirestoreCollectionType;
      return targetModelTemplateDetailsMap.get(targetFirestoreCollectionType) ?? [];
    }

  };

  return service;
}
