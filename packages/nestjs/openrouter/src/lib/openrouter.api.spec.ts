import { describe, it, expect } from 'vitest';
import { OpenRouterApi } from './openrouter.api';
import { type OpenRouterRetryConfig } from './openrouter.type';

describe('OpenRouterApi', () => {
  describe('openRouterClient', () => {
    it('should pass timeoutMs and retryConfig to the SDK client', () => {
      const retryConfig: OpenRouterRetryConfig = { strategy: 'none' };
      const api = new OpenRouterApi({ openrouter: { apiKey: 'k', timeoutMs: 1234, retryConfig } });

      expect(api.openRouterClient._options.timeoutMs).toBe(1234);
      expect(api.openRouterClient._options.retryConfig).toEqual(retryConfig);
    });

    it('should leave timeoutMs and retryConfig undefined when unset', () => {
      const api = new OpenRouterApi({ openrouter: { apiKey: 'k' } });

      expect(api.openRouterClient._options.timeoutMs).toBeUndefined();
      expect(api.openRouterClient._options.retryConfig).toBeUndefined();
    });

    it('should leave timeoutMs and retryConfig undefined when null', () => {
      const api = new OpenRouterApi({ openrouter: { apiKey: 'k', timeoutMs: null, retryConfig: null } });

      expect(api.openRouterClient._options.timeoutMs).toBeUndefined();
      expect(api.openRouterClient._options.retryConfig).toBeUndefined();
    });
  });
});
