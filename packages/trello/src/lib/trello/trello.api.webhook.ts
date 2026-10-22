import { isTrelloApiKeyTokenConfig } from '../trello.config';
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
 * @param context - The Trello API context.
 * @returns Registers a new webhook.
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
 * Https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#retrieving-a-webhook.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a webhook by id.
 */
export function getWebhook(context: TrelloContext): GetWebhookFunction {
  return (input) => context.fetchJson(`/webhooks/${input.webhookId}`, 'GET');
}

export interface UpdateWebhookInput extends UpdateWebhookBody {
  readonly webhookId: TrelloWebhookId;
}

export type UpdateWebhookFunction = (input: UpdateWebhookInput) => Promise<TrelloWebhook>;

/**
 * Https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#updating-a-webhook.
 *
 * @param context - The Trello API context.
 * @returns Updates an existing webhook.
 */
export function updateWebhook(context: TrelloContext): UpdateWebhookFunction {
  return (input) => {
    const { webhookId, ...body } = input;
    return context.fetchJson(`/webhooks/${webhookId}`, 'PUT', body);
  };
}

export type DeleteWebhookFunction = (input: GetWebhookInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#deleting-a-webhook.
 *
 * @param context - The Trello API context.
 * @returns Deletes a webhook.
 */
export function deleteWebhook(context: TrelloContext): DeleteWebhookFunction {
  return async (input) => {
    await context.fetchJson(`/webhooks/${input.webhookId}`, 'DELETE');
  };
}

export interface ListWebhooksForTokenInput {
  /**
   * Optional override for the token whose webhooks to list. Defaults to the context's configured token
   * in the key+token mode; REQUIRED in either bearer mode, which has no API token of its own.
   */
  readonly apiToken?: TrelloApiToken;
}

export type ListWebhooksForTokenFunction = (input?: ListWebhooksForTokenInput) => Promise<ReadonlyArray<TrelloWebhook>>;

/**
 * Https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/.
 *
 * @param context - The Trello API context.
 * @returns Lists all webhooks registered for a token.
 */
export function listWebhooksForToken(context: TrelloContext): ListWebhooksForTokenFunction {
  return (input) => {
    const config = context.config;
    const token = input?.apiToken ?? (isTrelloApiKeyTokenConfig(config) ? config.apiToken : undefined);

    if (!token) {
      throw new Error('listWebhooksForToken() is for the legacy key+token mode only; pass an explicit apiToken. OAuth 2.0 webhooks are created with POST /1/webhooks.');
    }

    return context.fetchJson(`/tokens/${token}/webhooks`, 'GET');
  };
}
