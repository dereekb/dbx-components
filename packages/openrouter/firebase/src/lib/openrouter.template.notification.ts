import { type CreateNotificationTemplate, type CreateNotificationTemplateInput, type NotificationTemplateType, type NotificationTemplateTypeInfo, NotificationDeliveryMethod, createNotificationTemplate } from '@dereekb/firebase';
import { type OpenRouterPromptVersionNumber, type OpenRouterTemplateKey } from '@dereekb/openrouter';
import { type Maybe } from '@dereekb/util';

// MARK: Template Text Notification
/**
 * Notification template type of the opt-in, library-provided template-text notification.
 *
 * A template-text notification sends any message template by key as a text. Its recipient policy still comes from the
 * template's type: a template of a type without `allowMultipleRecipients` sends nothing when the notification would reach
 * more than one person.
 */
export const OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'ORTT';

/**
 * Config for {@link openRouterTemplateTextNotificationTemplateTypeInfo}.
 */
export type OpenRouterTemplateTextNotificationTemplateTypeInfoConfig = Pick<NotificationTemplateTypeInfo, 'notificationModelIdentity'> & Partial<Omit<NotificationTemplateTypeInfo, 'type' | 'notificationModelIdentity'>>;

/**
 * Creates the {@link NotificationTemplateTypeInfo} of the template-text notification type for an app.
 *
 * The app supplies the model identity its notification boxes live on. Delivery is by text, with the in-app summary
 * next to it; both are user-configurable, since texts cannot be forced.
 *
 * Recipient rule: a template rendered for several recipients may only load data that EVERY recipient of the
 * notification may see. When the content has to differ per person, create one notification per recipient instead.
 *
 * @param config - The notification model identity, plus any overrides.
 * @returns The template type info, ready for the app's `notificationTemplateTypeInfoRecord`.
 */
export function openRouterTemplateTextNotificationTemplateTypeInfo(config: OpenRouterTemplateTextNotificationTemplateTypeInfoConfig): NotificationTemplateTypeInfo {
  return {
    name: 'Template Text',
    description: 'A text message rendered from a message template.',
    userConfigurableDeliveryMethods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY],
    ...config,
    type: OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE
  };
}

/**
 * Stored data of a template-text notification.
 *
 * IDENTIFIERS ONLY: a NotificationItem's `d` is copied into the summary and week documents, which share a single 1 MiB
 * document each. Keep `i` to the keys the template's loaders need, never the loaded data itself.
 *
 * Recipient rule: the template is rendered once per notification, and every recipient gets the identical body. For a
 * template whose type allows multiple recipients, its loaders may only return data that EVERY recipient may see. When the
 * content has to differ per person, create one notification per recipient instead.
 */
export interface OpenRouterTemplateTextNotificationData {
  /**
   * The template key.
   */
  readonly k: OpenRouterTemplateKey;
  /**
   * The version to render. Defaults to the template's active version.
   */
  readonly v?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The template input.
   */
  readonly i: unknown;
}

/**
 * Input for {@link createOpenRouterTemplateTextNotificationTemplate}.
 */
export interface CreateOpenRouterTemplateTextNotificationTemplateInput extends Omit<CreateNotificationTemplateInput, 'type' | 'data'> {
  /**
   * The template key.
   */
  readonly templateKey: OpenRouterTemplateKey;
  /**
   * The version to render. Defaults to the template's active version at send time.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The template input. Identifiers only; see {@link OpenRouterTemplateTextNotificationData}.
   */
  readonly input: unknown;
}

/**
 * Creates a template-text notification template.
 *
 * Recipient rule: every recipient of the notification gets the identical body. Address one person per notification
 * unless the template's type allows multiple recipients and its loaders only return data every recipient may see.
 *
 * @param input - The template key, version and input, plus the usual notification template fields.
 * @returns The notification template.
 *
 * @example
 * ```ts
 * const template = createOpenRouterTemplateTextNotificationTemplate({
 *   templateKey: 'welcome',
 *   input: { profileKey: profileDocument.key },
 *   notificationModel: profileDocument,
 *   recipients: [{ uid: profileDocument.id }]
 * });
 * ```
 */
export function createOpenRouterTemplateTextNotificationTemplate(input: CreateOpenRouterTemplateTextNotificationTemplateInput): CreateNotificationTemplate {
  const { templateKey, version, input: templateInput, ...notificationTemplateInput } = input;
  const data: OpenRouterTemplateTextNotificationData = { k: templateKey, v: version, i: templateInput };

  return createNotificationTemplate({
    ...notificationTemplateInput,
    type: OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE,
    data
  });
}
