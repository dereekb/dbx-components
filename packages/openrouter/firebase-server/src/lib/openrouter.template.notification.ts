import { type NotificationItemMetadata, type NotificationMessage, type NotificationMessageFunctionFactory, type NotificationMessageFunctionFactoryConfig, type NotificationMessageInputContext, NotificationMessageFlag, notificationMessageFunction } from '@dereekb/firebase';
import { type OpenRouterTemplateTextNotificationData } from '@dereekb/openrouter/firebase';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type OpenRouterTemplateRenderResult, type OpenRouterTemplateService, type RenderOpenRouterTemplateParams } from './openrouter.template.service';

/**
 * Input to {@link OpenRouterTemplateNotificationBuildMessageFunction}.
 */
export interface OpenRouterTemplateNotificationBuildMessageInput<D extends NotificationItemMetadata = {}> {
  /**
   * The rendered text. Identical for every recipient of the notification.
   */
  readonly text: string;
  /**
   * The full render result.
   */
  readonly renderResult: OpenRouterTemplateRenderResult;
  /**
   * The recipient's input context.
   */
  readonly inputContext: NotificationMessageInputContext;
  /**
   * The notification the message is for.
   */
  readonly config: NotificationMessageFunctionFactoryConfig<D>;
}

/**
 * Builds the message one recipient receives from the rendered text.
 *
 * It must not add recipient-specific content beyond what the input context already carries, since the text was rendered
 * once for every recipient.
 */
export type OpenRouterTemplateNotificationBuildMessageFunction<D extends NotificationItemMetadata = {}> = (input: OpenRouterTemplateNotificationBuildMessageInput<D>) => PromiseOrValue<NotificationMessage<D>>;

/**
 * Config for {@link openRouterTemplateNotificationMessageFunctionFactory}.
 */
export interface OpenRouterTemplateNotificationMessageFunctionFactoryConfig<D extends NotificationItemMetadata = {}> {
  /**
   * The template service that renders the text.
   */
  readonly templateService: OpenRouterTemplateService;
  /**
   * Returns the render params for the notification.
   *
   * Called once per notification, before recipients are expanded, so the params can never depend on the recipient. Every
   * recipient of the notification gets the identical body.
   *
   * Recipient rule: for a template whose type has `allowMultipleRecipients`, the template's loaders may only return data that
   * EVERY recipient of the notification may see. When the content has to differ per person, create one notification per
   * recipient instead. A template of a type without `allowMultipleRecipients` sends nothing when the notification would reach
   * more than one person.
   *
   * Return null/undefined to send nothing.
   */
  readonly renderParamsForItem: (config: NotificationMessageFunctionFactoryConfig<D>) => PromiseOrValue<Maybe<RenderOpenRouterTemplateParams>>;
  /**
   * Builds each recipient's message from the rendered text.
   *
   * Defaults to `{ content: { title: text }, textContent: { title: text } }`, which the text send services send as the body.
   */
  readonly buildMessage?: Maybe<OpenRouterTemplateNotificationBuildMessageFunction<D>>;
}

/**
 * The default {@link OpenRouterTemplateNotificationBuildMessageFunction}. Uses the text as the title of the content and of the text content.
 *
 * @param input - The rendered text and the recipient's input context.
 * @returns The message.
 */
export function defaultOpenRouterTemplateNotificationBuildMessage<D extends NotificationItemMetadata = {}>(input: OpenRouterTemplateNotificationBuildMessageInput<D>): NotificationMessage<D> {
  const { text, inputContext, config } = input;

  return {
    inputContext,
    item: config.item,
    content: { title: text },
    textContent: { title: text }
  };
}

/**
 * Creates a {@link NotificationMessageFunctionFactory} that sends a rendered message template.
 *
 * The template is rendered ONCE per notification, inside the factory and before recipients are expanded. The returned
 * per-recipient function only copies that text into a message carrying the recipient's input context, so every recipient
 * gets the identical body and modes that call a model make one call per notification. A render error fails the send
 * attempt, which the notification system retries; a retry re-renders, so the remaining recipients get the retry's text.
 *
 * Recipient limit: the message function's `maxRecipients` is 1 unless the template's type has `allowMultipleRecipients`, so a
 * single-recipient template never reaches two people by accident (a box with several subscribers, explicit or global recipients).
 *
 * An empty render result sends nothing ({@link NotificationMessageFlag.DO_NOT_SEND}).
 *
 * @param config - The template service, the render params for a notification, and the optional message builder.
 * @returns The message function factory.
 */
export function openRouterTemplateNotificationMessageFunctionFactory<D extends NotificationItemMetadata = {}>(config: OpenRouterTemplateNotificationMessageFunctionFactoryConfig<D>): NotificationMessageFunctionFactory<D> {
  const { templateService, renderParamsForItem } = config;
  const buildMessage = config.buildMessage ?? defaultOpenRouterTemplateNotificationBuildMessage;

  return async (factoryConfig: NotificationMessageFunctionFactoryConfig<D>) => {
    const renderParams = await renderParamsForItem(factoryConfig);
    const renderResult = renderParams ? await templateService.renderTemplate(renderParams) : undefined;
    const text = renderResult?.empty === false ? renderResult.text : undefined;
    const allowMultipleRecipients = renderResult ? templateService.typeConfigService.configForTemplateType(renderResult.templateType).allowMultipleRecipients === true : false;

    return notificationMessageFunction(
      async (inputContext: NotificationMessageInputContext) => {
        let message: NotificationMessage<D>;

        if (text && renderResult) {
          message = await buildMessage({ text, renderResult, inputContext, config: factoryConfig });
        } else {
          message = { flag: NotificationMessageFlag.DO_NOT_SEND, inputContext, content: { title: '' } };
        }

        return message;
      },
      { maxRecipients: allowMultipleRecipients ? undefined : 1 }
    );
  };
}

/**
 * Config for {@link openRouterTemplateTextNotificationMessageFunctionFactory}.
 */
export type OpenRouterTemplateTextNotificationMessageFunctionFactoryConfig = Omit<OpenRouterTemplateNotificationMessageFunctionFactoryConfig<OpenRouterTemplateTextNotificationData>, 'renderParamsForItem'>;

/**
 * Creates the {@link NotificationMessageFunctionFactory} of the template-text notification type
 * (`OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE`). It renders the template named by the notification's data (`n.d`).
 *
 * Recipient rule: see {@link openRouterTemplateNotificationMessageFunctionFactory}. Loaders of a multi-recipient template may only
 * return data every recipient may see; create one notification per recipient when the content differs.
 *
 * @param config - The template service and the optional message builder.
 * @returns The message function factory.
 */
export function openRouterTemplateTextNotificationMessageFunctionFactory(config: OpenRouterTemplateTextNotificationMessageFunctionFactoryConfig): NotificationMessageFunctionFactory<OpenRouterTemplateTextNotificationData> {
  return openRouterTemplateNotificationMessageFunctionFactory<OpenRouterTemplateTextNotificationData>({
    ...config,
    renderParamsForItem: ({ item, notification }) => {
      const data = item.d;
      let params: Maybe<RenderOpenRouterTemplateParams>;

      if (data?.k) {
        params = { templateKey: data.k, version: data.v, input: data.i, trace: { notificationKey: notification.key } };
      }

      return params;
    }
  });
}
