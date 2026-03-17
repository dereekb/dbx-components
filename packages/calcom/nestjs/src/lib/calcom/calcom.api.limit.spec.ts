import { appCalcomModuleMetadata } from './calcom.module';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CalcomApi } from './calcom.api';
import { fileCalcomOAuthAccessTokenCacheService, CalcomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { appCalcomOAuthModuleMetadata } from '../oauth/oauth.module';

const cacheService = fileCalcomOAuthAccessTokenCacheService();

@Module(
  appCalcomOAuthModuleMetadata({
    exports: [CalcomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestCalcomOAuthModule {}

@Module(appCalcomModuleMetadata({ dependencyModule: TestCalcomOAuthModule }))
class TestCalcomModule {}

describe('calcom.api.limit', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestCalcomModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('CalcomApi', () => {
    let api: CalcomApi;

    beforeEach(() => {
      api = nest.get(CalcomApi);
    });

    describe('rate limit test', () => {
      it('should hit the limit on the sandbox', async () => {
        // does nothing. Used only for testing manually.
        /*
        const result = await Promise.all(range(DEFAULT_CALCOM_API_RATE_LIMIT).map(() => {
          return api.getMe();
        }));

        console.log('done...');

        await waitForMs(10000);
        */
      });
    });
  });
});
