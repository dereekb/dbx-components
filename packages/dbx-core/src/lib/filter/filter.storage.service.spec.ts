import { TestBed } from '@angular/core/testing';
import { type FilterJsonConverter } from '@dereekb/rxjs';
import { MemoryStorageInstance } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { SimpleStorageAccessorFactory } from '../storage/storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN } from '../storage/storage.di';
import { FullLocalStorageObject } from '../storage/storage.object.localstorage';
import { provideDbxFilterStorage } from './filter.storage.providers';
import { DbxFilterStorageService } from './filter.storage.service';

interface TestStorageFilter {
  name?: string;
  date?: Date;
}

interface TestStorageFilterJson {
  name?: string;
  date?: string;
}

const TEST_STORAGE_FILTER_JSON_CONVERTER: FilterJsonConverter<TestStorageFilter, TestStorageFilterJson> = {
  toJson: (x) => ({ ...x, date: x.date?.toISOString() }),
  fromJson: (x) => ({ ...x, date: x.date ? new Date(x.date) : undefined })
};

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

    it('should return the saved filter.', async () => {
      await firstValueFrom(service.saveFilter<TestStorageFilter>('test', { name: 'a' }));

      const result = await firstValueFrom(service.loadFilter<TestStorageFilter>('test'));
      expect(result).toEqual({ name: 'a' });
    });

    it('should convert the saved filter with the json converter.', async () => {
      const date = new Date('2026-01-02T03:04:05.000Z');
      await firstValueFrom(service.saveFilter('test', { name: 'a', date }, TEST_STORAGE_FILTER_JSON_CONVERTER));

      const json = await firstValueFrom(service.loadFilter<TestStorageFilterJson>('test'));
      expect(json).toEqual({ name: 'a', date: date.toISOString() });

      const result = await firstValueFrom(service.loadFilter('test', TEST_STORAGE_FILTER_JSON_CONVERTER));
      expect(result?.name).toBe('a');
      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date?.getTime()).toBe(date.getTime());
    });

    it('should return undefined if the json converter throws.', async () => {
      await firstValueFrom(service.saveFilter<TestStorageFilter>('test', { name: 'a' }));

      const result = await firstValueFrom(
        service.loadFilter<TestStorageFilter>('test', {
          toJson: (x) => x,
          fromJson: () => {
            throw new Error('invalid');
          }
        })
      );

      expect(result).toBeUndefined();
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
});
