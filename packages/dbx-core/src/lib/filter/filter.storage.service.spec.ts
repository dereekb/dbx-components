import { TestBed } from '@angular/core/testing';
import { FilterMap } from '@dereekb/rxjs';
import { MemoryStorageInstance } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';
import { filter, first, firstValueFrom, Subject } from 'rxjs';
import { SimpleStorageAccessorFactory } from '../storage/storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN } from '../storage/storage.di';
import { FullLocalStorageObject } from '../storage/storage.object.localstorage';
import { provideDbxFilterStorage } from './filter.storage.providers';
import { DbxFilterStorageService } from './filter.storage.service';

interface TestStorageFilter {
  name?: string;
  date?: Date;
}

describe('DbxFilterStorageService', () => {
  let service: DbxFilterStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DEFAULT_STORAGE_OBJECT_TOKEN, useValue: new FullLocalStorageObject(new MemoryStorageInstance()) }, SimpleStorageAccessorFactory, provideDbxFilterStorage()]
    });

    service = TestBed.inject(DbxFilterStorageService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('loadFilter()', () => {
    it('should return undefined if no filter is saved.', async () => {
      const result = await firstValueFrom(service.loadFilter<TestStorageFilter>('missing'));
      expect(result).toBeUndefined();
    });

    it('should return the saved filter with its dates revived.', async () => {
      const date = new Date('2026-01-02T03:04:05.000Z');
      await firstValueFrom(service.saveFilter<TestStorageFilter>('test', { name: 'a', date }));

      const result = await firstValueFrom(service.loadFilter<TestStorageFilter>('test'));
      expect(result?.name).toBe('a');
      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date?.getTime()).toBe(date.getTime());
    });

    it('should not revive strings that only contain a date.', async () => {
      const name = 'saved at 2026-01-02T03:04:05.000Z';
      await firstValueFrom(service.saveFilter<TestStorageFilter>('test', { name }));

      const result = await firstValueFrom(service.loadFilter<TestStorageFilter>('test'));
      expect(result?.name).toBe(name);
    });
  });

  describe('clearFilter()', () => {
    it('should remove the saved filter.', async () => {
      await firstValueFrom(service.saveFilter<TestStorageFilter>('test', { name: 'a' }));
      await firstValueFrom(service.clearFilter('test'));

      const result = await firstValueFrom(service.loadFilter<TestStorageFilter>('test'));
      expect(result).toBeUndefined();
    });
  });

  describe('persistFilterMapKey()', () => {
    const key = 'a';
    let filterMap: FilterMap<TestStorageFilter>;

    beforeEach(() => {
      filterMap = new FilterMap<TestStorageFilter>();
    });

    afterEach(() => {
      filterMap.destroy();
    });

    it(
      'should use the default filter if no filter is saved.',
      callbackTest((done) => {
        const persisted = service.persistFilterMapKey({ filterMap, key, defaultFilter: { name: 'default' } });

        filterMap
          .filterForKey(key)
          .pipe(first())
          .subscribe((x) => {
            expect(x).toEqual({ name: 'default' });
            persisted.destroy();
            done();
          });
      })
    );

    it(
      'should use the saved filter instead of the default filter.',
      callbackTest((done) => {
        service.saveFilter<TestStorageFilter>(key, { name: 'saved' }).subscribe(() => {
          const persisted = service.persistFilterMapKey({ filterMap, key, defaultFilter: { name: 'default' } });

          filterMap
            .filterForKey(key)
            .pipe(first())
            .subscribe((x) => {
              expect(x).toEqual({ name: 'saved' });
              persisted.destroy();
              done();
            });
        });
      })
    );

    it(
      'should map the loaded filter using mapLoadedFilter.',
      callbackTest((done) => {
        service.saveFilter<TestStorageFilter>(key, { name: 'saved' }).subscribe(() => {
          const persisted = service.persistFilterMapKey({ filterMap, key, defaultFilter: { name: 'default' }, mapLoadedFilter: (x) => ({ ...x, name: `${x.name}-mapped` }) });

          filterMap
            .filterForKey(key)
            .pipe(first())
            .subscribe((x) => {
              expect(x).toEqual({ name: 'saved-mapped' });
              persisted.destroy();
              done();
            });
        });
      })
    );

    it(
      'should save changes to the key.',
      callbackTest((done) => {
        const writes = new Subject<TestStorageFilter>();
        const persisted = service.persistFilterMapKey({ filterMap, key, storageKey: 'b', defaultFilter: {} });

        filterMap
          .filterForKey(key)
          .pipe(
            filter((x) => x.name === 'changed'),
            first()
          )
          .subscribe(() => {
            service.loadFilter<TestStorageFilter>('b').subscribe((saved) => {
              expect(saved).toEqual({ name: 'changed' });
              persisted.destroy();
              done();
            });
          });

        filterMap.addFilterObs(key, writes);
        writes.next({ name: 'changed' });
      })
    );

    describe('reset()', () => {
      it(
        'should set the key back to the default filter and remove the saved filter.',
        callbackTest((done) => {
          service.saveFilter<TestStorageFilter>(key, { name: 'saved' }).subscribe(() => {
            const persisted = service.persistFilterMapKey<TestStorageFilter>({ filterMap, key, defaultFilter: { name: 'default' } });
            const values: TestStorageFilter[] = [];
            filterMap.filterForKey(key).subscribe((x) => values.push(x));

            expect(values[values.length - 1]).toEqual({ name: 'saved' });

            persisted.reset().subscribe(() => {
              expect(values[values.length - 1]).toEqual({ name: 'default' });

              service.loadFilter<TestStorageFilter>(key).subscribe((saved) => {
                expect(saved).toBeUndefined();
                persisted.destroy();
                done();
              });
            });
          });
        })
      );

      it(
        'should save changes made after the reset.',
        callbackTest((done) => {
          const writes = new Subject<TestStorageFilter>();
          const persisted = service.persistFilterMapKey<TestStorageFilter>({ filterMap, key, defaultFilter: {} });
          filterMap.addFilterObs(key, writes);
          writes.next({ name: 'a' });

          persisted.reset().subscribe(() => {
            writes.next({ name: 'b' });

            service.loadFilter<TestStorageFilter>(key).subscribe((saved) => {
              expect(saved).toEqual({ name: 'b' });
              persisted.destroy();
              done();
            });
          });
        })
      );
    });
  });
});
