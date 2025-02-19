import { Maybe, ModelRelationUtility, UNSET_INDEX_NUMBER, areEqualPOJOValues, areEqualPOJOValuesUsingPojoFilter, filterKeysOnPOJOFunction, filterOnlyUndefinedValues, filterUndefinedValues, makeModelMap, updateMaybeValue } from '@dereekb/util';
import { NotificationBoxRecipientTemplateConfigRecord, NotificationUserDefaultNotificationBoxRecipientConfig, NotificationUserNotificationBoxRecipientConfig, notificationBoxRecipientTemplateConfigArrayToRecord, notificationBoxRecipientTemplateConfigRecordToArray, updateNotificationRecipient } from './notification.config';
import { NotificationBoxRecipientTemplateConfigArrayEntryParam, UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams, UpdateNotificationUserNotificationBoxRecipientParams } from './notification.api';
import { AppNotificationTemplateTypeInfoRecordService } from './notification.details';
import { NotificationTemplateType, inferNotificationBoxRelatedModelKey } from './notification.id';

/**
 * Updates a NotificationUserDefaultNotificationBoxRecipientConfig with the input UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams.
 *
 * @param a
 * @param b
 * @returns
 */
export function updateNotificationBoxRecipientTemplateConfigRecord(a: NotificationBoxRecipientTemplateConfigRecord, b: NotificationBoxRecipientTemplateConfigArrayEntryParam[], limitToAllowedConfigTypes?: Maybe<Iterable<NotificationTemplateType>>): NotificationBoxRecipientTemplateConfigRecord | undefined {
  let c: NotificationBoxRecipientTemplateConfigRecord | undefined;

  if (b != null) {
    const cArray = notificationBoxRecipientTemplateConfigRecordToArray(a);
    let updatedC = ModelRelationUtility.insertCollection(cArray, b, { readKey: (x) => x.type, readType: () => 'x', merge: (x, y) => ({ ...x, ...y }) });

    // remove types marked as remove
    updatedC = ModelRelationUtility.removeKeysFromCollection(
      updatedC,
      b.filter((x) => x.remove).map((x) => x.type),
      (x) => x.type
    );

    c = notificationBoxRecipientTemplateConfigArrayToRecord(updatedC);

    // if the config types are limited to specific types, then filter those only
    if (limitToAllowedConfigTypes) {
      c = filterKeysOnPOJOFunction<typeof c>(limitToAllowedConfigTypes)(c);
    }
  }

  return c;
}

/**
 * Updates a NotificationUserDefaultNotificationBoxRecipientConfig with the input UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams.
 *
 * @param a
 * @param b
 * @returns
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

export function updateNotificationUserNotificationBoxRecipientConfigIfChanged(a: NotificationUserNotificationBoxRecipientConfig, b: UpdateNotificationUserNotificationBoxRecipientParams, limitToAllowedConfigTypes?: Maybe<Iterable<NotificationTemplateType>>): NotificationUserNotificationBoxRecipientConfig | undefined {
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
 * Updates the target NotificationUserNotificationBoxRecipientConfig array with the input UpdateNotificationUserNotificationBoxRecipientParams.
 *
 * If the target NotificationBox does not exist in the config, it is ignored.
 *
 * @param a
 * @param b
 */
export function updateNotificationUserNotificationBoxRecipientConfigs(a: NotificationUserNotificationBoxRecipientConfig[], b: UpdateNotificationUserNotificationBoxRecipientParams[], filterWithService?: AppNotificationTemplateTypeInfoRecordService): NotificationUserNotificationBoxRecipientConfig[] | undefined {
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
