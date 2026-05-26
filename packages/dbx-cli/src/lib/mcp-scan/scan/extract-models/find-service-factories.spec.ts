import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { findServiceFactories } from './find-service-factories.js';

function serviceFactories(source: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sf = project.createSourceFile('x.ts', source, { overwrite: true });
  return findServiceFactories(sf);
}

describe('findServiceFactories()', () => {
  it('captures a single tagged factory', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory guestbook
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([{ modelType: 'guestbook', exportName: 'guestbookFirebaseModelServiceFactory' }]);
  });

  it('captures multiple tagged factories in source order', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory guestbook
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
      /**
       * @dbxModelServiceFactory guestbookEntry
       */
      export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result.map((r) => r.modelType)).toEqual(['guestbook', 'guestbookEntry']);
  });

  it('skips exports without the tag', () => {
    const result = serviceFactories(`
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([]);
  });

  it('drops a tag with no value', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([]);
  });

  it('drops a tag with a non-camelCase value', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory Guestbook
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([]);
  });

  it('drops a tag with a kebab-case value', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory guest-book
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([]);
  });

  it('keeps only the first @dbxModelServiceFactory when multiple are declared', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory guestbook
       * @dbxModelServiceFactory guestbookEntry
       */
      export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([{ modelType: 'guestbook', exportName: 'guestbookFirebaseModelServiceFactory' }]);
  });

  it('ignores non-exported declarations', () => {
    const result = serviceFactories(`
      /**
       * @dbxModelServiceFactory guestbook
       */
      const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory({});
    `);
    expect(result).toEqual([]);
  });
});
