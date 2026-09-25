import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { type FilterJsonConverter, type FilterMap } from '@dereekb/rxjs';
import { MemoryStorageInstance, type Maybe } from '@dereekb/util';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { SimpleStorageAccessorFactory } from '../storage/storage.accessor.simple.factory';
import { DEFAULT_STORAGE_OBJECT_TOKEN } from '../storage/storage.di';
import { FullLocalStorageObject } from '../storage/storage.object.localstorage';
import { DbxFilterMapDirective } from './filter.map.directive';
import { type DbxFilterMapStorageConfig, DbxFilterMapStorageDirective } from './filter.map.storage.directive';
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

const TEST_KEY = 'a';
const TEST_STORAGE_KEY = 'test.a';

describe('DbxFilterMapStorageDirective', () => {
  let service: DbxFilterStorageService;
  let fixture: ComponentFixture<TestDbxFilterMapStorageDirectiveComponent>;
  let filterMap: FilterMap<TestStorageFilter>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DEFAULT_STORAGE_OBJECT_TOKEN, useValue: new FullLocalStorageObject(new MemoryStorageInstance()) }, SimpleStorageAccessorFactory, provideDbxFilterStorage()]
    });

    service = TestBed.inject(DbxFilterStorageService);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  async function createComponent(config: DbxFilterMapStorageConfig<TestStorageFilter, TestStorageFilterJson>) {
    fixture = TestBed.createComponent(TestDbxFilterMapStorageDirectiveComponent);
    fixture.componentInstance.config.set(config);
    fixture.detectChanges();
    await fixture.whenStable();
    filterMap = fixture.componentInstance.filterMap().filterMap;
  }

  it('should use the default filter if no filter is saved.', async () => {
    await createComponent({ key: TEST_KEY, storageKey: TEST_STORAGE_KEY, defaultFilter: { name: 'default' } });

    const result = await firstValueFrom(filterMap.filterForKey(TEST_KEY));
    expect(result).toEqual({ name: 'default' });
  });

  it('should use the saved filter, converted with the json converter and mapped with mapLoadedFilter.', async () => {
    const date = new Date('2026-01-02T03:04:05.000Z');
    await firstValueFrom(service.saveFilter(TEST_STORAGE_KEY, { name: 'saved', date }, TEST_STORAGE_FILTER_JSON_CONVERTER));

    await createComponent({
      key: TEST_KEY,
      storageKey: TEST_STORAGE_KEY,
      defaultFilter: { name: 'default' },
      jsonConverter: TEST_STORAGE_FILTER_JSON_CONVERTER,
      mapLoadedFilter: (x) => ({ ...x, name: `${x.name}-mapped` })
    });

    const result = await firstValueFrom(filterMap.filterForKey(TEST_KEY));
    expect(result.name).toBe('saved-mapped');
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.getTime()).toBe(date.getTime());
  });

  it('should save changes to the key with the json converter.', async () => {
    const date = new Date('2026-01-02T03:04:05.000Z');
    await createComponent({ key: TEST_KEY, storageKey: TEST_STORAGE_KEY, defaultFilter: {}, jsonConverter: TEST_STORAGE_FILTER_JSON_CONVERTER });

    const writes = new Subject<TestStorageFilter>();
    filterMap.addFilterObs(TEST_KEY, writes);
    writes.next({ name: 'changed', date });

    const saved = await firstValueFrom(service.loadFilter<TestStorageFilterJson>(TEST_STORAGE_KEY));
    expect(saved).toEqual({ name: 'changed', date: date.toISOString() });
  });

  it('should not save the loaded filter.', async () => {
    await createComponent({ key: TEST_KEY, storageKey: TEST_STORAGE_KEY, defaultFilter: { name: 'default' } });
    await firstValueFrom(filterMap.filterForKey(TEST_KEY));

    const saved = await firstValueFrom(service.loadFilter<TestStorageFilter>(TEST_STORAGE_KEY));
    expect(saved).toBeUndefined();
  });

  describe('reset()', () => {
    it('should set the key back to the default filter and remove the saved filter.', async () => {
      await firstValueFrom(service.saveFilter<TestStorageFilter>(TEST_STORAGE_KEY, { name: 'saved' }));
      await createComponent({ key: TEST_KEY, storageKey: TEST_STORAGE_KEY, defaultFilter: { name: 'default' } });

      expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({ name: 'saved' });

      await firstValueFrom(fixture.componentInstance.storage().reset());

      expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({ name: 'default' });
      expect(await firstValueFrom(service.loadFilter<TestStorageFilter>(TEST_STORAGE_KEY))).toBeUndefined();
    });

    it('should save changes made after the reset.', async () => {
      await createComponent({ key: TEST_KEY, storageKey: TEST_STORAGE_KEY, defaultFilter: {} });

      const writes = new Subject<TestStorageFilter>();
      filterMap.addFilterObs(TEST_KEY, writes);
      writes.next({ name: 'a' });

      await firstValueFrom(fixture.componentInstance.storage().reset());
      writes.next({ name: 'b' });

      await firstValueFrom(filterMap.filterForKey(TEST_KEY).pipe(filter((x) => x.name === 'b')));
      expect(await firstValueFrom(service.loadFilter<TestStorageFilter>(TEST_STORAGE_KEY))).toEqual({ name: 'b' });
    });
  });
});

@Component({
  template: `
    <ng-container dbxFilterMap>
      <ng-container [dbxFilterMapStorage]="config()"></ng-container>
    </ng-container>
  `,
  imports: [DbxFilterMapDirective, DbxFilterMapStorageDirective]
})
class TestDbxFilterMapStorageDirectiveComponent {
  readonly config = signal<Maybe<DbxFilterMapStorageConfig<TestStorageFilter, TestStorageFilterJson>>>(undefined);
  readonly filterMap = viewChild.required<DbxFilterMapDirective<TestStorageFilter>>(DbxFilterMapDirective);
  readonly storage = viewChild.required<DbxFilterMapStorageDirective<TestStorageFilter, TestStorageFilterJson>>(DbxFilterMapStorageDirective);
}
