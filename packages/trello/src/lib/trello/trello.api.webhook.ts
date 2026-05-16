import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloApiToken, type TrelloWebhookId } from '../trello.type';
import { type CreateWebhookBody, type TrelloWebhook, type UpdateWebhookBody } from './trello.api.webhook.type';

export type CreateWebhookFunction = (input: CreateWebhookBody) => Promise<TrelloWebhook>;

/**
 * Trello validates the callback URL with a HEAD request before creation. The endpoint MUST return 200.
 *
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#creating-a-webhook
 *
 * @param context The Trello API context.
 * @returns A function that registers a new webhook.
 */
export function createWebhook(context: TrelloContext): CreateWebhookFunction {
  return (input) => {
    const queryString = makeUrlSearchParams(input);
    return context.fetchJson(`/webhooks?${queryString}`, 'POST');
  };
}

export interface GetWebhookInput {
  readonly webhookId: TrelloWebhookId;
}

export type GetWebhookFunction = (input: GetWebhookInput) => Promise<TrelloWebhook>;

/**
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#retrieving-a-webhook
 *
 * @param context The Trello API context.
 * @returns A function that retrieves a webhook by id.
 */
export function getWebhook(context: TrelloContext): GetWebhookFunction {
  return (input) => context.fetchJson(`/webhooks/${input.webhookId}`, 'GET');
}

export interface UpdateWebhookInput extends UpdateWebhookBody {
  readonly webhookId: TrelloWebhookId;
}

export type UpdateWebhookFunction = (input: UpdateWebhookInput) => Promise<TrelloWebhook>;

/**
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#updating-a-webhook
 *
 * @param context The Trello API context.
 * @returns A function that updates an existing webhook.
 */
export function updateWebhook(context: TrelloContext): UpdateWebhookFunction {
  return (input) => {
    const { webhookId, ...body } = input;
    return context.fetchJson(`/webhooks/${webhookId}`, 'PUT', body);
  };
}

export type DeleteWebhookFunction = (input: GetWebhookInput) => Promise<void>;

/**
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#deleting-a-webhook
 *
 * @param context The Trello API context.
 * @returns A function that deletes a webhook.
 */
export function deleteWebhook(context: TrelloContext): DeleteWebhookFunction {
  return async (input) => {
    await context.fetchJson(`/webhooks/${input.webhookId}`, 'DELETE');
  };
}

export interface ListWebhooksForTokenInput {
  /**
   * Optional override for the token whose webhooks to list. Defaults to the context's configured token.
   */
  readonly apiToken?: TrelloApiToken;
}

export type ListWebhooksForTokenFunction = (input?: ListWebhooksForTokenInput) => Promise<ReadonlyArray<TrelloWebhook>>;

/**
 * https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
 *
 * @param context The Trello API context.
 * @returns A function that lists all webhooks registered for a token.
 */
export function listWebhooksForToken(context: TrelloContext): ListWebhooksForTokenFunction {
  return (input) => {
    const token = input?.apiToken ?? context.config.apiToken;
    return context.fetchJson(`/tokens/${token}/webhooks`, 'GET');
  };
}
