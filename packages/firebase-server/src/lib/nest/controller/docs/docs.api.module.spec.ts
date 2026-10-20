import { describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { DocsApiModuleConfig } from './docs.api.config';
import { DYNAMIC_DOCS_SOURCES, type DynamicDocsSource } from './docs.api.dynamic';
import { docsApiModuleMetadata } from './docs.api.module';
import { DocsApiService } from './docs.api.service';

const TEST_DYNAMIC_DOCS_SOURCE: DynamicDocsSource = {
  name: 'test',
  loadDocs: () => [{ id: 'dynamic/hello', title: 'Hello', audience: ['any'], content: '# Hello\n\n## Greeting\n\nHi.\n' }]
};

const TEST_AUTH = { uid: 'u1', token: {} } as unknown as FirebaseServerAuthData;

@Module({
  providers: [
    { provide: DocsApiModuleConfig, useValue: {} },
    { provide: DYNAMIC_DOCS_SOURCES, useValue: [TEST_DYNAMIC_DOCS_SOURCE] }
  ],
  exports: [DocsApiModuleConfig, DYNAMIC_DOCS_SOURCES]
})
class TestDynamicDocsApiDependencyModule {}

@Module(docsApiModuleMetadata({ dependencyModule: TestDynamicDocsApiDependencyModule }))
class TestDynamicDocsApiModule {}

@Module({
  providers: [{ provide: DocsApiModuleConfig, useValue: {} }],
  exports: [DocsApiModuleConfig]
})
class TestDocsApiDependencyModule {}

@Module(docsApiModuleMetadata({ dependencyModule: TestDocsApiDependencyModule }))
class TestDocsApiModule {}

describe('docsApiModuleMetadata()', () => {
  it('should inject the DYNAMIC_DOCS_SOURCES the dependency module exports', async () => {
    const nest = await Test.createTestingModule({ imports: [TestDynamicDocsApiModule] }).compile();
    const service = nest.get(DocsApiService);

    expect(service.listDocs(TEST_AUTH).docs).toEqual([{ id: 'dynamic/hello', title: 'Hello', sections: [{ id: 'greeting', title: 'Greeting', depth: 2 }] }]);
    await nest.close();
  });

  it('should serve no docs without DYNAMIC_DOCS_SOURCES or a manifest', async () => {
    const nest = await Test.createTestingModule({ imports: [TestDocsApiModule] }).compile();
    expect(nest.get(DocsApiService).docCount).toBe(0);
    await nest.close();
  });
});
