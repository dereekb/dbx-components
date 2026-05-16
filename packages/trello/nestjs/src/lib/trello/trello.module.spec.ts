import { Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TrelloApi } from './trello.api';
import { TrelloServiceConfig } from './trello.config';
import { appTrelloModuleMetadata } from './trello.module';

@Module({
  ...appTrelloModuleMetadata(),
  providers: [
    ...(appTrelloModuleMetadata().providers ?? []).filter((provider) => {
      // Replace the default config provider with a test fixture.
      return typeof provider === 'function' || !('provide' in provider) || provider.provide !== TrelloServiceConfig;
    }),
    {
      provide: TrelloServiceConfig,
      useValue: {
        trello: {
          apiKey: 'test-key',
          apiToken: 'test-token'
        }
      } satisfies TrelloServiceConfig
    }
  ]
})
class TestTrelloModule {}

describe('appTrelloModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const rootModule: DynamicModule = {
      module: TestTrelloModule,
      global: true
    };

    nest = await Test.createTestingModule({
      imports: [rootModule]
    }).compile();
  });

  describe('TrelloApi', () => {
    let api: TrelloApi;

    beforeEach(() => {
      api = nest.get(TrelloApi);
    });

    it('is provided and configured', () => {
      expect(api).toBeDefined();
      expect(api.config.trello.apiKey).toBe('test-key');
      expect(api.config.trello.apiToken).toBe('test-token');
    });

    it('exposes a trelloContext with the supplied config', () => {
      expect(api.trelloContext).toBeDefined();
      expect(api.trelloContext.config.apiKey).toBe('test-key');
      expect(api.trelloContext.config.apiToken).toBe('test-token');
    });

    it('exposes a rate limiter', () => {
      expect(api.trelloRateLimiter).toBeDefined();
    });

    it('exposes accessor functions for the major resources', () => {
      expect(typeof api.getBoard).toBe('function');
      expect(typeof api.createCard).toBe('function');
      expect(typeof api.listBoardLists).toBe('function');
      expect(typeof api.getMe).toBe('function');
      expect(typeof api.createWebhook).toBe('function');
    });
  });
});
