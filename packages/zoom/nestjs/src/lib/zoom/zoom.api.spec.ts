import { appZoomModuleMetadata } from './zoom.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZoomApi } from './zoom.api';
import { fileZoomOAuthAccessTokenCacheService, ZoomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { ZoomRecord } from '@dereekb/zoom';
import { appZoomOAuthModuleMetadata } from '../oauth/oauth.module';

const cacheService = fileZoomOAuthAccessTokenCacheService();

interface TestCandidate extends ZoomRecord {
  Email: string; // required field
  First_Name?: string; // not required
  Last_Name: string;
}

jest.setTimeout(12000);

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

describe('recruit.api', () => {
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

    describe('todo', () => {
      it('todo', () => {
        expect(true).toBe(true);
      });
    });
  });
});
