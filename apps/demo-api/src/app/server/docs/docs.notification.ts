import {
  compareNotificationTemplateTypeInfoGroups,
  NotificationDeliveryMethod,
  notificationSettingsGroupForTemplateTypeInfo,
  notificationTemplateTypeInfoForcedDeliveryMethods,
  notificationTemplateTypeInfoUserConfigurableDeliveryMethods,
  type NotificationTemplateTypeInfo,
  type NotificationTemplateTypeInfoRecord
} from '@dereekb/firebase';
import { type DynamicDocsEntry, type DynamicDocsSource } from '@dereekb/firebase-server';
import { makeValuesGroupMap } from '@dereekb/util';
import { DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';

/**
 * Id of the doc built by {@link demoNotificationTypesDocsSource}.
 */
export const DEMO_NOTIFICATION_TYPES_DOC_ID = 'notification/types';

/**
 * How each delivery method is named in the notification types doc.
 */
const DEMO_NOTIFICATION_DELIVERY_METHOD_NAMES: Record<NotificationDeliveryMethod, string> = {
  [NotificationDeliveryMethod.EMAIL]: 'email',
  [NotificationDeliveryMethod.TEXT]: 'text',
  [NotificationDeliveryMethod.PUSH]: 'push',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'in-app summary'
};

function deliveryMethodNames(methods: NotificationDeliveryMethod[]): string {
  return methods.length > 0 ? methods.map((x) => DEMO_NOTIFICATION_DELIVERY_METHOD_NAMES[x]).join(', ') : 'none';
}

function notificationTypeMarkdown(info: NotificationTemplateTypeInfo): string {
  const lines = [
    `### ${info.name} (\`${info.type}\`)`,
    '',
    info.description,
    '',
    `- Type code: \`${info.type}\``,
    `- Notification box: \`${info.notificationModelIdentity.modelType}\``,
    `- About: \`${(info.targetModelIdentity ?? info.notificationModelIdentity).modelType}\``,
    `- A user can turn on or off: ${deliveryMethodNames(notificationTemplateTypeInfoUserConfigurableDeliveryMethods(info))}`,
    `- Always delivered by: ${deliveryMethodNames(notificationTemplateTypeInfoForcedDeliveryMethods(info))}`
  ];

  if (info.onlySendToExplicitlyEnabledRecipients) {
    lines.push('- Only sent to recipients who turned it on.');
  }

  if (info.hideFromUserSettings) {
    lines.push('- Not shown in notification settings.');
  }

  return lines.join('\n');
}

/**
 * Renders a notification type registry as one doc: an H2 per settings group and an H3 per type, both sorted the way the
 * notification settings list sorts them (`sortOrder`, then name).
 *
 * @param record - The registry to render.
 * @returns The notification types doc.
 */
export function demoNotificationTypesDocsEntry(record: NotificationTemplateTypeInfoRecord): DynamicDocsEntry {
  const groups = Array.from(makeValuesGroupMap(Object.values(record), (x) => notificationSettingsGroupForTemplateTypeInfo(x, {}).key).values())
    .map((infos) => ({ group: notificationSettingsGroupForTemplateTypeInfo(infos[0], {}), infos: [...infos].sort(compareNotificationTemplateTypeInfoGroups) }))
    .sort((a, b) => compareNotificationTemplateTypeInfoGroups(a.group, b.group));

  const content = [
    '# Notification types',
    '',
    "The notifications the Demo API sends, grouped as they appear in a user's notification settings. Each type lists its",
    'type code, the model whose notification box receives it, what it is about, and how it is delivered.',
    '',
    'This page is built by the server from its notification type registry, so it always matches the types it sends.',
    ...groups.flatMap(({ group, infos }) => ['', `## ${group.name}`, ...(group.description ? ['', group.description] : []), ...infos.flatMap((x) => ['', notificationTypeMarkdown(x)])]),
    ''
  ].join('\n');

  return {
    id: DEMO_NOTIFICATION_TYPES_DOC_ID,
    title: 'Notification types',
    description: 'Every notification type the Demo API sends: its type code, where it is delivered and which delivery methods a user controls.',
    tags: ['notification', 'settings'],
    audience: ['user'],
    content
  };
}

/**
 * Dynamic docs source that serves {@link DEMO_NOTIFICATION_TYPES_DOC_ID}, rendered from
 * `DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD` so the doc stays current as notification types are added.
 *
 * @returns The source.
 */
export function demoNotificationTypesDocsSource(): DynamicDocsSource {
  return {
    name: 'demo-notification-types',
    loadDocs: () => [demoNotificationTypesDocsEntry(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)]
  };
}
