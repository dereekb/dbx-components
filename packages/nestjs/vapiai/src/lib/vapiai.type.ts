import { ChatCostsItem, CallCostsItem, ServerMessageEndOfCallReportCostsItem } from '@vapi-ai/server-sdk/api';

/**
 * Secret token used by Vapi.ai for making requests.
 */
export type VapiAiSecretToken = string;

/**
 * Secret token used by Vapi.ai for validating webhook events.
 */
export type VapiAiWebhookSecretToken = string;

/**
 * Type of verification to use for validating webhook events.
 *
 * none:
 * - no verification is performed
 *
 * secret:
 * - uses the x-vapi-secret header to verify the webhook event by comparing it to the secret
 *
 * hmac:
 * - uses a secret key along with HMAC to verify the webhook event. Requires configuration!
 * - must configure the hmac setup in the Vapi.ai console at https://dashboard.vapi.ai/settings/integrations
 * -- supply a secret token, but keep all other settings as default
 * --- defaults:
 * ---- signature header: x-signature
 * ---- timestamp header: x-timestamp
 * ---- payload format: {timestamp}.{body}
 * ---- signature encoding: hex
 */
export type VapiApiWebhookEventVerificationType = 'none' | 'secret' | 'hmac';

/**
 * Cost item used by Vapi.ai.
 */
export type VapiCostsItem = ChatCostsItem | CallCostsItem | ServerMessageEndOfCallReportCostsItem;

/**
 * Assistant id used by Vapi.ai.
 */
export type VapiAssistantId = string;
