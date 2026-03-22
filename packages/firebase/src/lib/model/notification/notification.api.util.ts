/**
 * @module notification.api.util
 *
 * Utility functions for applying {@link UpdateNotificationUserParams} changes to notification config objects.
 * Used by the server action service when processing user config update requests.
 */
import { type Maybe, ModelRelationUtility, UNSET_INDEX_NUMBER, areEqualPOJOValuesUsingPojoFilter, filterKeysOnPOJOFunction, filterOnlyUndefinedValues, makeModelMap, updateMaybeValue } from '@dereekb/util';
import { type NotificationBoxRecipientTemplateConfigRecord, type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationUserNotificationBoxRecipientConfig, notificationBoxRecipientTemplateConfigArrayToRecord, notificationBoxRecipientTemplateConfigRecordToArray, updateNotificationRecipient } from './notification.config';
import { type NotificationBoxRecipientTemplateConfigArrayEntryParam, type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams, type UpdateNotificationUserNotificationBoxRecipientParams } from './notification.api';
import { type AppNotificationTemplateTypeInfoRecordService } from './notification.details';
import { type NotificationTemplateType, inferNotificationBoxRelatedModelKey } from './notification.id';

/**
 * Applies an array of config entry params to a {@link NotificationBoxRecipientTemplateConfigRecord},
 * inserting new entries, merging updates, and removing entries marked with `remove: true`.
 *
 * @param a - existing config record
 * @param b - array of update params to apply
 * @param limitToAllowedConfigTypes - when provided, filters the result to only include these template types
 * @returns the updated config record, or undefined if no changes were made
 */
export function updateNotificationBoxRecipientTemplateConfigRecord(a: NotificationBoxRecipientTemplateConfigRecord, b: NotificationBoxRecipientTemplateConfigArrayEntryParam[], limitToAllowedConfigTypes?: Maybe<Iterable<NotificationTemplateType>>): Maybe<NotificationBoxRecipientTemplateConfigRecord> {
  const cArray = notificationBoxRecipientTemplateConfigRecordToArray(a);
  let updatedC = ModelRelationUtility.insertCollection(cArray, b, { readKey: (x) => x.type, merge: (x, y) => ({ ...x, ...y }) });

  // remove types marked as remove
  updatedC = ModelRelationUtility.removeKeysFromCollection(
    updatedC,
    b.filter((x) => x.remove).map((x) => x.type),
    (x) => x.type
  );

  let c = notificationBoxRecipientTemplateConfigArrayToRecord(updatedC);

  // if the config types are limited to specific types, then filter those only
  if (limitToAllowedConfigTypes) {
    c = filterKeysOnPOJOFunction<typeof c>(limitToAllowedConfigTypes)(c);
  }

  return c;
}

/**
 * Applies {@link UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams} to an existing
 * {@link NotificationUserDefaultNotificationBoxRecipientConfig}, producing an updated config.
 *
 * @param a - existing config
 * @param b - update params to apply
 * @param limitToAllowedConfigTypes - when provided, filters config types to only allowed template types
 * @returns the updated default recipient config
 */
export function updateNotificationUserDefaultNotificationBoxRecipientConfig(a: NotificationUserDefaultNotificationBoxRecipientConfig, b: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams, limitToAllowedConfigTypes?: Maybe<Iterable<NotificationTemplateType>>): NotificationUserDefaultNotificationBoxRecipientConfig {
  const { configs: inputC, f: inputF, bk: inputBk, lk: inputLk } = b;
  const c = (inputC != null ? updateNotificationBoxRecipientTemplateConfigRecord(a.c, inputC, limitToAllowedConfigTypes) : undefined) ?? a.c;

  return {
    ...updateNotificationRecipient(a, b),
    c,
    f: updateMaybeValue(a.f, inputF),
    bk: updateMaybeValue(a.bk, inputBk),
    lk: updateMaybeValue(a.lk, inputLk)
  };
}

/**
 * Applies update params to a {@link NotificationUserNotificationBoxRecipientConfig} and returns the updated config
 * only if it actually changed. Returns `undefined` if no changes were detected.
 *
 * Automatically sets `ns = true` (needs sync) when changes are detected and the recipient has been indexed.
 *
 * @param a - existing per-box recipient config
 * @param b - update params to apply
 * @param limitToAllowedConfigTypes - when provided, filters template config types to only allowed types
 * @returns the updated config if changes were detected, or undefined if no changes occurred
 */
export function updateNotificationUserNotificationBoxRecipientConfigIfChanged(a: NotificationUserNotificationBoxRecipientConfig, b: UpdateNotificationUserNotificationBoxRecipientParams, limitToAllowedConfigTypes?: Maybe<Iterable<NotificationTemplateType>>): Maybe<NotificationUserNotificationBoxRecipientConfig> {
  const { configs: inputC, rm: inputRm, lk: inputLk, bk: inputBk } = b;
  const c = (inputC != null ? updateNotificationBoxRecipientTemplateConfigRecord(a.c, inputC, limitToAllowedConfigTypes) : undefined) ?? a.c;

  const nextConfig: NotificationUserNotificationBoxRecipientConfig = {
    ...updateNotificationRecipient(a, b),
    c,
    rm: updateMaybeValue(a.rm, inputRm),
    lk: updateMaybeValue(a.lk, inputLk),
    bk: updateMaybeValue(a.bk, inputBk),
    // values remain the same
    ns: a.ns,
    nb: a.nb,
    i: a.i
  };

  const configChanged = !areEqualPOJOValuesUsingPojoFilter(nextConfig, a, filterOnlyUndefinedValues);
  let result: NotificationUserNotificationBoxRecipientConfig | undefined;

  if (configChanged) {
    nextConfig.ns = a.i !== UNSET_INDEX_NUMBER; // needs sync unless i is unset
    result = nextConfig;
  }

  return result;
}

/**
 * Batch-applies an array of {@link UpdateNotificationUserNotificationBoxRecipientParams} to the user's
 * per-box config array. Only updates configs for boxes that already exist in the user's config.
 *
 * Handles deletion of removed configs (when `deleteRemovedConfig` is set) and filters template types
 * through the optional {@link AppNotificationTemplateTypeInfoRecordService}.
 *
 * Returns `undefined` if no changes were made.
 *
 * @param a - existing per-box recipient config array
 * @param b - array of update params to apply to matching boxes
 * @param filterWithService - optional service used to filter template types to only those valid for each box's model
 * @returns the updated config array if any changes occurred, or undefined if nothing changed
 */
export function updateNotificationUserNotificationBoxRecipientConfigs(a: NotificationUserNotificationBoxRecipientConfig[], b: UpdateNotificationUserNotificationBoxRecipientParams[], filterWithService?: AppNotificationTemplateTypeInfoRecordService): Maybe<NotificationUserNotificationBoxRecipientConfig[]> {
  const boxesMap = makeModelMap(a, (x) => x.nb);

  let hasChanges = false;

  b.forEach((x) => {
    const existingBox = boxesMap.get(x.nb);

    if (existingBox) {
      if (x.deleteRemovedConfig && existingBox.rm && existingBox.i === UNSET_INDEX_NUMBER) {
        // delete if marked as removed and already sync'd
        boxesMap.delete(x.nb);
        hasChanges = true;
      } else {
        let allowedConfigTypes: Maybe<NotificationTemplateType[]>;

        if (filterWithService && x.configs != null) {
          const modelKey = inferNotificationBoxRelatedModelKey(existingBox.nb);
          allowedConfigTypes = filterWithService.getTemplateTypesForNotificationModel(modelKey);
        }

        // perform update
        const updatedConfig = updateNotificationUserNotificationBoxRecipientConfigIfChanged(existingBox, x, allowedConfigTypes);

        if (updatedConfig) {
          boxesMap.set(x.nb, updatedConfig);
          hasChanges = true;
        }
      }
    }
  });

  let result: NotificationUserNotificationBoxRecipientConfig[] | undefined;

  if (hasChanges) {
    result = Array.from(boxesMap.values());
  }

  return result;
}
