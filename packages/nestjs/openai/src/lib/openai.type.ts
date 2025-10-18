import { type MaybeSo } from '@dereekb/util';
import { type OpenAI } from 'openai';

/**
 * Api key used by OpenAI for making requests.
 */
export type OpenAIApiKey = string;

/**
 * Your OpenAI organization id.
 */
export type OpenAIOrganizationId = string;

/**
 * Your OpenAI project id.
 */
export type OpenAIProjectId = string;

/**
 * Webhook secret used by OpenAI for validating webhook events.
 */
export type OpenAIWebhookSecret = string;

/**
 * Assistant id used by OpenAI.
 */
export type OpenAIAssistantId = string;

/**
 * OpenAI response
 */
export type OpenAIResponse = OpenAI.Responses.Response;

/**
 * OpenAI response id
 */
export type OpenAIResponseId = string;

/**
 * Metadata for an OpenAI request.
 */
export type OpenAIResponseMetadata = MaybeSo<OpenAI.Responses.Response['metadata']>;
