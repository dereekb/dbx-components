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
import { NotificationDeliveryMethod, type NotificationExplicitOptInConfig } from './notification.config';

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
 * Key of a {@link NotificationTemplateTypeInfoGroup}. Template types whose groups share a key are shown together.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationTemplateTypeInfoGroupKey = string;

/**
 * A named group of notification template types, used to organize the template types in a user's notification settings.
 *
 * Every {@link NotificationTemplateTypeInfo} that references a group with the same key must reference an identical definition.
 * Define each group once as a constant and reuse it.
 */
export interface NotificationTemplateTypeInfoGroup {
  /**
   * Unique key of the group.
   */
  readonly key: NotificationTemplateTypeInfoGroupKey;
  /**
   * Human-readable group name shown as the group header.
   */
  readonly name: string;
  /**
   * Optional description shown with the group header.
   */
  readonly description?: Maybe<string>;
  /**
   * Sort order of the group relative to the other groups. Lower values are shown first.
   */
  readonly sortOrder?: Maybe<number>;
}

/**
 * The delivery methods a user can configure per template type by default.
 *
 * Push is left out because push notifications are not delivered yet.
 */
export const DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS: NotificationDeliveryMethod[] = [NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY];

/**
 * Complete metadata for a notification template type. Defines display info, model associations,
 * and delivery rules for a specific {@link NotificationTemplateType}.
 *
 * Registered in the application's {@link NotificationTemplateTypeInfoRecord} and accessed at runtime
 * via the {@link AppNotificationTemplateTypeInfoRecordService}.
 *
 * The {@link NotificationExplicitOptInConfig} fields decide what each delivery method does for a recipient whose config leaves it unset.
 */
export interface NotificationTemplateTypeInfo extends NotificationTemplateTypeInfoIdentityInfo, NotificationExplicitOptInConfig {
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
   * Group this template type is shown under in a user's notification settings.
   */
  readonly group?: Maybe<NotificationTemplateTypeInfoGroup>;
  /**
   * Sort order of this template type within its group. Lower values are shown first.
   */
  readonly sortOrder?: Maybe<number>;
  /**
   * Whether to hide this template type from a user's notification settings, such as for internal or test notifications.
   *
   * Defaults to false.
   */
  readonly hideFromUserSettings?: Maybe<boolean>;
  /**
   * The delivery methods a user can configure for this template type.
   *
   * Defaults to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}.
   */
  readonly userConfigurableDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
}

/**
 * Returns the delivery methods a user can configure for the template type.
 *
 * @param info - The template type info.
 * @returns The configured `userConfigurableDeliveryMethods`, or {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}.
 */
export function notificationTemplateTypeInfoUserConfigurableDeliveryMethods(info: Pick<NotificationTemplateTypeInfo, 'userConfigurableDeliveryMethods'>): NotificationDeliveryMethod[] {
  return info.userConfigurableDeliveryMethods ?? DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS;
}

/**
 * Record of NotificationTemplateTypeInfo keyed by type.
 */
export type NotificationTemplateTypeInfoRecord = Record<NotificationTemplateType, NotificationTemplateTypeInfo>;

/**
 * Creates a {@link NotificationTemplateTypeInfoRecord} from an array of template type info entries.
 *
 * @param infoArray - Array of template type info entries to index.
 * @returns A record keyed by template type.
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

    if (record[type]) {
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
 * @throws {Error} When two template types reference different {@link NotificationTemplateTypeInfoGroup} definitions that share a key.
 * @param appNotificationTemplateTypeInfoRecord - The complete template type registry for the application.
 * @returns A fully initialized service with indexed lookups for fast template type discovery.
 *
 * @example
 * ```ts
 * const service = appNotificationTemplateTypeInfoRecordService(
 *   notificationTemplateTypeInfoRecord([commentInfo, inviteInfo])
 * );
 * const types = service.getTemplateTypesForNotificationModel('project/abc123');
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function appNotificationTemplateTypeInfoRecordService(appNotificationTemplateTypeInfoRecord: NotificationTemplateTypeInfoRecord): AppNotificationTemplateTypeInfoRecordService {
  const allNotificationModelIdentityValuesSet = new Set<FirestoreModelIdentity>();

  const notificationModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();
  const targetModelTypeInfoMapBuilder = multiValueMapBuilder<NotificationTemplateTypeInfo, FirestoreCollectionType>();

  const allKnownTemplateTypes: NotificationTemplateType[] = [];
  const allKnownTemplateTypeInfo: NotificationTemplateTypeInfo[] = [];
  const groupsByKey = new Map<NotificationTemplateTypeInfoGroupKey, NotificationTemplateTypeInfoGroup>();

  Object.entries(appNotificationTemplateTypeInfoRecord).forEach(([_, info]) => {
    const { notificationModelIdentity, targetModelIdentity, alternativeModelIdentities, group } = info;

    if (group != null) {
      const existingGroup = groupsByKey.get(group.key);

      if (existingGroup == null) {
        groupsByKey.set(group.key, group);
      } else if (existingGroup !== group && (existingGroup.name !== group.name || existingGroup.description !== group.description || existingGroup.sortOrder !== group.sortOrder)) {
        throw new Error(`appNotificationTemplateTypeInfoRecordService(): conflicting NotificationTemplateTypeInfoGroup definitions for group key "${group.key}" on NotificationTemplateType "${info.type}".`);
      }
    }

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

  const allNotificationModelIdentityValues = Array.from(allNotificationModelIdentityValuesSet);

  const notificationModelTemplateInfoMap = notificationModelTypeInfoMapBuilder.map();
  const targetModelTemplateInfoMap = targetModelTypeInfoMapBuilder.map();

  const notificationModelTemplateTypesMap = new Map(Array.from(notificationModelTemplateInfoMap.entries()).map(([k, x]) => [k as NotificationTemplateType, (x ?? []).map((y) => y.type)]));
  const targetModelTemplateTypesMap = new Map(Array.from(targetModelTemplateInfoMap.entries()).map(([k, x]) => [k as NotificationTemplateType, (x ?? []).map((y) => y.type)]));

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
