/**
 * @module notification.details
 *
 * Template type metadata for the notification system. Each {@link NotificationTemplateType} is described by a
 * {@link NotificationTemplateTypeInfo} entry that maps it to model identities, display info, and delivery rules.
 *
 * The {@link AppNotificationTemplateTypeInfoRecordService} provides runtime lookup of template types by model,
 * enabling the server to discover which notification types apply to a given Firestore model.
 */
import { type Maybe, multiValueMapBuilder, type ArrayOrValue, asArray } from '@dereekb/util';
import { type FirestoreCollectionType, type FirestoreModelIdentity, type ReadFirestoreModelKeyInput, firestoreModelKeyCollectionType, readFirestoreModelKey } from '../../common';
import { type NotificationTemplateType } from './notification.id';

/**
 * Alternative model identity pair for cases where notifications are attached to a different model
 * than the one defined in {@link NotificationTemplateTypeInfoIdentityInfo.notificationModelIdentity}.
 *
 * For example, a notification may be defined for a "project" model but actually delivered via
 * a "team" model's NotificationBox. The alternative model must always have a NotificationBox.
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
 * Model identity mapping for a notification template type. Defines which Firestore models
 * are associated with this notification type and which one owns the NotificationBox.
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
 * Complete metadata for a notification template type. Defines display info, model associations,
 * and delivery rules for a specific {@link NotificationTemplateType}.
 *
 * Registered in the application's {@link NotificationTemplateTypeInfoRecord} and accessed at runtime
 * via the {@link AppNotificationTemplateTypeInfoRecordService}.
 */
export interface NotificationTemplateTypeInfo extends NotificationTemplateTypeInfoIdentityInfo {
  /**
   * Template type identifier (e.g., `'comment'`, `'invite'`). Should be short to minimize Firestore storage.
   */
  readonly type: NotificationTemplateType;
  /**
   * Human-readable name for display in notification preference UIs.
   */
  readonly name: string;
  /**
   * Description of what this notification type conveys, shown in preference management UIs.
   */
  readonly description: string;
  /**
   * When true, only sends to recipients who have explicitly enabled this template type in their
   * {@link NotificationBoxRecipientTemplateConfig}. Recipients without an explicit opt-in are skipped.
   *
   * Overridable per-notification via {@link Notification.ois}.
   */
  readonly onlySendToExplicitlyEnabledRecipients?: boolean;
  /**
   * When false, sends text/SMS to all recipients regardless of explicit opt-in status
   * (still respects explicit opt-outs).
   *
   * Overridable per-notification via {@link Notification.ots}.
   */
  readonly onlyTextExplicitlyEnabledRecipients?: boolean;
}

/**
 * Record of NotificationTemplateTypeInfo keyed by type.
 */
export type NotificationTemplateTypeInfoRecord = Record<NotificationTemplateType, NotificationTemplateTypeInfo>;

/**
 * Creates a {@link NotificationTemplateTypeInfoRecord} from an array of template type info entries.
 *
 * @param infoArray - array of template type info entries to index
 * @returns a record keyed by template type
 * @throws {Error} When duplicate template types are found in the input array.
 *
 * @example
 * ```ts
 * const record = notificationTemplateTypeInfoRecord([
 *   { type: 'comment', name: 'Comment', description: 'New comment notifications', notificationModelIdentity: projectIdentity },
 *   { type: 'invite', name: 'Invite', description: 'Team invite notifications', notificationModelIdentity: teamIdentity }
 * ]);
 * ```
 */
export function notificationTemplateTypeInfoRecord(infoArray: NotificationTemplateTypeInfo[]): NotificationTemplateTypeInfoRecord {
  const record: NotificationTemplateTypeInfoRecord = {};

  infoArray.forEach((x) => {
    const { type } = x;

    if (record[type] != null) {
      // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- record is mutated inside loop
      throw new Error(`notificationTemplateTypeInfoRecord(): duplicate NotificationTemplateType in record: ${type}`);
    }

    record[type] = x;
  });

  return record;
}

/**
 * Reference to an {@link AppNotificationTemplateTypeInfoRecordService} instance.
 *
 * Used for dependency injection in modules that need access to the template type registry.
 */
export interface AppNotificationTemplateTypeInfoRecordServiceRef {
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
}

/**
 * Runtime service for looking up {@link NotificationTemplateTypeInfo} by model identity or template type.
 *
 * Built from a {@link NotificationTemplateTypeInfoRecord} via {@link appNotificationTemplateTypeInfoRecordService}.
 * Provides indexed lookups for the server-side notification pipeline to discover which template types
 * apply to a given model.
 */
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

/**
 * Creates an {@link AppNotificationTemplateTypeInfoRecordService} from the given template type record.
 *
 * Builds internal indexes for fast lookup by notification model identity and target model identity.
 * Handles alternative model identities defined in {@link NotificationTemplateTypeInfoIdentityInfoAlternativeModelIdentityPair}.
 *
 * @param appNotificationTemplateTypeInfoRecord - the complete template type registry for the application
 * @returns a fully initialized service with indexed lookups for fast template type discovery
 *
 * @example
 * ```ts
 * const service = appNotificationTemplateTypeInfoRecordService(
 *   notificationTemplateTypeInfoRecord([commentInfo, inviteInfo])
 * );
 * const types = service.getTemplateTypesForNotificationModel('project/abc123');
 * ```
 */
export function appNotificationTemplateTypeInfoRecordService(appNotificationTemplateTypeInfoRecord: NotificationTemplateTypeInfoRecord): AppNotificationTemplateTypeInfoRecordService {
  const allNotificationModelIdentityValuesSet = new Set<FirestoreModelIdentity>();

  const notificationModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();
  const targetModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();

  const allKnownTemplateTypes: NotificationTemplateType[] = [];
  const allKnownTemplateTypeInfo: NotificationTemplateTypeInfo[] = [];

  Object.entries(appNotificationTemplateTypeInfoRecord).forEach(([_, info]) => {
    const { notificationModelIdentity, targetModelIdentity, alternativeModelIdentities } = info;

    function addInfoForIdentity(modelIdentity: FirestoreModelIdentity, targetIdentity?: Maybe<FirestoreModelIdentity>) {
      const { collectionType } = modelIdentity;

      notificationModelTypeInfoMapBuilder.add(collectionType, info);
      targetModelTypeInfoMapBuilder.add(targetIdentity?.collectionType ?? collectionType, info);

      allNotificationModelIdentityValuesSet.add(modelIdentity);
    }

    addInfoForIdentity(notificationModelIdentity, targetModelIdentity);

    if (alternativeModelIdentities != null) {
      asArray(alternativeModelIdentities).forEach((x) => {
        addInfoForIdentity(x.altNotificationModelIdentity, x.altTargetModelIdentity ?? targetModelIdentity);
      });
    }

    allKnownTemplateTypeInfo.push(info);
    allKnownTemplateTypes.push(info.type);
  });

  const allNotificationModelIdentityValues = [...allNotificationModelIdentityValuesSet];

  const notificationModelTemplateInfoMap = notificationModelTypeInfoMapBuilder.map();
  const targetModelTemplateInfoMap = targetModelTypeInfoMapBuilder.map();

  const notificationModelTemplateTypesMap = new Map([...notificationModelTemplateInfoMap.entries()].map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));
  const targetModelTemplateTypesMap = new Map([...targetModelTemplateInfoMap.entries()].map(([k, x]) => [k as NotificationTemplateType, x.map((y) => y.type)]));

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
