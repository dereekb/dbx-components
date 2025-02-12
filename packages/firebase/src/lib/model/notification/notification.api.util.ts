import { NotificationBoxId, NotificationUserDefaultNotificationBoxRecipientConfig, NotificationUserNotificationBoxRecipientConfig, UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams, UpdateNotificationUserNotificationBoxRecipientParams, notificationBoxRecipientTemplateConfigArrayToRecord, updateNotificationRecipient } from '@dereekb/firebase';
import { UNSET_INDEX_NUMBER, areEqualPOJOValues, makeModelMap, updateMaybeValue } from '@dereekb/util';

/**
 * Updates a NotificationUserDefaultNotificationBoxRecipientConfig with the input UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams.
 *
 * @param a
 * @param b
 * @returns
 */
export function updateNotificationUserDefaultNotificationBoxRecipientConfig(a: NotificationUserDefaultNotificationBoxRecipientConfig, b: UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams): NotificationUserDefaultNotificationBoxRecipientConfig {
  const { configs: inputC, f: inputF, lk: inputLk } = b;
  const c = inputC != null ? notificationBoxRecipientTemplateConfigArrayToRecord(inputC) : a.c;

  return {
    ...updateNotificationRecipient(a, b),
    c,
    f: updateMaybeValue(a.f, inputF),
    lk: updateMaybeValue(a.lk, inputLk)
  };
}

export function updateNotificationUserNotificationBoxRecipientConfigIfChanged(a: NotificationUserNotificationBoxRecipientConfig, b: UpdateNotificationUserNotificationBoxRecipientParams): NotificationUserNotificationBoxRecipientConfig | undefined {
  const { configs: inputC, rm: inputRm, lk: inputLk, bk: inputBk } = b;
  const c = inputC != null ? notificationBoxRecipientTemplateConfigArrayToRecord(inputC) : a.c;

  const nextConfig: NotificationUserNotificationBoxRecipientConfig = {
    ...updateNotificationRecipient(a, b),
    c,
    rm: updateMaybeValue(a.rm, inputRm),
    lk: updateMaybeValue(a.lk, inputLk),
    bk: updateMaybeValue(a.bk, inputBk),
    ns: a.ns,
    m: a.m,
    nb: a.nb,
    i: a.i
  };

  const configChanged = !areEqualPOJOValues(nextConfig, a);
  let result: NotificationUserNotificationBoxRecipientConfig | undefined;

  if (configChanged) {
    nextConfig.ns = a.i !== UNSET_INDEX_NUMBER; // needs sync unless i is undefined
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
export function updateNotificationUserNotificationBoxRecipientConfigs(a: NotificationUserNotificationBoxRecipientConfig[], b: UpdateNotificationUserNotificationBoxRecipientParams[]): NotificationUserNotificationBoxRecipientConfig[] | undefined {
  const boxesMap = makeModelMap(a, (x) => x.nb);

  let hasChanges = false;

  b.forEach((x) => {
    const existingBox = boxesMap.get(x.nb);

    if (existingBox) {
      if (x.deleteAfterRemove && existingBox.rm && existingBox.i === UNSET_INDEX_NUMBER) {
        // delete if marked as removed and already sync'd
        boxesMap.delete(x.nb);
        hasChanges = true;
      } else {
        // perform update
        const updatedConfig = updateNotificationUserNotificationBoxRecipientConfigIfChanged(existingBox, x);

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
