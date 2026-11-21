import { type WebsiteUrlWithPrefix } from '@dereekb/util';
/**
 * OpenRouter's OpenAI-compatible base URL — the chat client, the decision transport and the `/key` credential probe
 * all resolve against it.
 */
export const DEFAULT_LLM_OPENROUTER_BASE_URL: WebsiteUrlWithPrefix = 'https://openrouter.ai/api/v1';
