import { describe, expect, it } from 'vitest';
import { TrelloServiceConfig } from './trello.config';

describe('TrelloServiceConfig', () => {
  describe('assertValidConfig', () => {
    it('does not throw when an apiKey and apiToken are provided', () => {
      const config: TrelloServiceConfig = {
        trello: {
          apiKey: 'test-key',
          apiToken: 'test-token'
        }
      };

      expect(() => TrelloServiceConfig.assertValidConfig(config)).not.toThrow();
    });

    it('throws when the apiKey is empty', () => {
      const config: TrelloServiceConfig = {
        trello: {
          apiKey: '',
          apiToken: 'test-token'
        }
      };

      expect(() => TrelloServiceConfig.assertValidConfig(config)).toThrow('No Trello API key specified.');
    });

    it('throws when the apiToken is empty', () => {
      const config: TrelloServiceConfig = {
        trello: {
          apiKey: 'test-key',
          apiToken: ''
        }
      };

      expect(() => TrelloServiceConfig.assertValidConfig(config)).toThrow('No Trello API token specified.');
    });
  });
});
