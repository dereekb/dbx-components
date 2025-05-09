import { appZoomModuleMetadata } from './zoom.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZoomApi } from './zoom.api';
import { fileZoomOAuthAccessTokenCacheService, ZoomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { ZoomRecord } from '@dereekb/zoom';
import { appZoomOAuthModuleMetadata } from '../oauth/oauth.module';

const cacheService = fileZoomOAuthAccessTokenCacheService();

@Module(
  appZoomOAuthModuleMetadata({
    exports: [ZoomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestZoomOAuthModule {}

@Module(appZoomModuleMetadata({ dependencyModule: TestZoomOAuthModule }))
class TestZoomModule {}

describe('recruit.api.limit', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZoomModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZoomApi', () => {
    let api: ZoomApi;

    beforeEach(() => {
      api = nest.get(ZoomApi);
    });

    describe('rate limit test', () => {
      it('should hit the limit on the sandbox', async () => {
        // does nothing. Used only for testing manually.
        /*
        const result = await Promise.all(range(DEFAULT_ZOOM_API_RATE_LIMIT).map(() => {
          return api.searchRecords<TestCandidate>({
            module: ZOOM_RECRUIT_CANDIDATES_MODULE,
            criteria: [{ field: 'First_Name', filter: 'equals', value: 'test' }]
          });
        }));

        console.log('done...');

        await waitForMs(10000);
        */
      });
    });
  });
});
