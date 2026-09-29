import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { type FilterMap } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, filter, firstValueFrom, Subject } from 'rxjs';
import { DbxRouterService } from '../router/router/service/router.service';
import { type SegueRefRawSegueParams } from '../router/segue';
import { DbxFilterMapDirective } from './filter.map.directive';
import { type DbxFilterMapRouteParamsConfig, DbxFilterMapRouteParamsDirective } from './filter.map.route.params.directive';

interface TestRouteParamsFilter {
  day?: string;
}

const TEST_KEY = 'a';
const TEST_DEFAULT_FILTER: TestRouteParamsFilter = { day: 'default' };

/**
 * Minimal controllable DbxRouterService exposing only params$ and updateParams().
 *
 * updateParams() merges into the current params and drops null values, like UIRouter does for query params.
 */
class TestDbxRouterService {
  readonly _params = new BehaviorSubject<SegueRefRawSegueParams>({});
  readonly params$ = this._params.asObservable();
  readonly updates: SegueRefRawSegueParams[] = [];

  updateParams(params: SegueRefRawSegueParams): Promise<boolean> {
    this.updates.push(params);
    const nextParams = Object.fromEntries(Object.entries({ ...this._params.value, ...params }).filter(([, value]) => value != null));
    this._params.next(nextParams);
    return Promise.resolve(true);
  }
}

function testConfig(write: boolean): DbxFilterMapRouteParamsConfig<TestRouteParamsFilter> {
  return {
    key: TEST_KEY,
    defaultFilter: TEST_DEFAULT_FILTER,
    filterFromParams: (params) => (typeof params['day'] === 'string' ? { day: params['day'] } : undefined),
    paramsFromFilter: write ? (x) => ({ day: x.day }) : undefined
  };
}

describe('DbxFilterMapRouteParamsDirective', () => {
  let router: TestDbxRouterService;
  let fixture: ComponentFixture<TestDbxFilterMapRouteParamsDirectiveComponent>;
  let filterMap: FilterMap<TestRouteParamsFilter>;

  beforeEach(() => {
    router = new TestDbxRouterService();
    TestBed.configureTestingModule({
      providers: [{ provide: DbxRouterService, useValue: router }]
    });
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  async function createComponent(config: DbxFilterMapRouteParamsConfig<TestRouteParamsFilter>, params: SegueRefRawSegueParams = {}) {
    router._params.next(params);
    fixture = TestBed.createComponent(TestDbxFilterMapRouteParamsDirectiveComponent);
    fixture.componentInstance.config.set(config);
    fixture.detectChanges();
    await fixture.whenStable();
    filterMap = fixture.componentInstance.filterMap().filterMap;
  }

  it('should use the default filter when the params carry no filter.', async () => {
    await createComponent(testConfig(true));
    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual(TEST_DEFAULT_FILTER);
  });

  it('should use the filter read from the params.', async () => {
    await createComponent(testConfig(true), { day: 'monday' });
    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({
      day: 'monday'
    });
  });

  it('should follow param changes.', async () => {
    await createComponent(testConfig(false), { day: 'monday' });
    router._params.next({ day: 'tuesday' });
    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({
      day: 'tuesday'
    });
  });

  it('should set the key to the params filter when the params change after the filter was changed.', async () => {
    await createComponent(testConfig(true));

    const writes = new Subject<TestRouteParamsFilter>();
    filterMap.addFilterObs(TEST_KEY, writes);
    writes.next({ day: 'friday' });

    router._params.next({ day: 'monday' });

    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({
      day: 'monday'
    });
    expect(router.updates).toEqual([{ day: 'friday' }]);
  });

  it('should set the key back to the default filter when its params are removed.', async () => {
    await createComponent(testConfig(true), { day: 'monday' });
    router._params.next({});

    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual(TEST_DEFAULT_FILTER);
    expect(router.updates).toEqual([]);
  });

  it('should not change the key when other params change.', async () => {
    await createComponent(testConfig(false), { day: 'monday' });
    filterMap.addFilterObs(TEST_KEY, new BehaviorSubject<TestRouteParamsFilter>({ day: 'friday' }));
    await firstValueFrom(filterMap.filterForKey(TEST_KEY).pipe(filter((x) => x.day === 'friday')));

    router._params.next({ day: 'monday', other: 'value' });

    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({
      day: 'friday'
    });
  });

  it('should not write the loaded filter back to the params.', async () => {
    await createComponent(testConfig(true), { day: 'monday' });
    await firstValueFrom(filterMap.filterForKey(TEST_KEY));
    expect(router.updates).toEqual([]);
  });

  it('should not write the default filter to the params.', async () => {
    await createComponent(testConfig(true));
    await firstValueFrom(filterMap.filterForKey(TEST_KEY));
    expect(router.updates).toEqual([]);
  });

  it('should write changes to the key to the params.', async () => {
    await createComponent(testConfig(true));

    const writes = new Subject<TestRouteParamsFilter>();
    filterMap.addFilterObs(TEST_KEY, writes);
    writes.next({ day: 'friday' });

    await firstValueFrom(router.params$.pipe(filter((x) => x['day'] === 'friday')));
    expect(router.updates).toEqual([{ day: 'friday' }]);
  });

  it('should remove the params when the key is set back to the default filter.', async () => {
    await createComponent(testConfig(true), { day: 'monday' });
    filterMap.setFilterForKey(TEST_KEY, { ...TEST_DEFAULT_FILTER });

    await firstValueFrom(router.params$.pipe(filter((x) => x['day'] == null)));
    expect(router.updates).toEqual([{ day: null }]);
  });

  it('should not write to the params when paramsFromFilter is not set.', async () => {
    await createComponent(testConfig(false));

    // nothing subscribes to the key while writing is off, so the change has to replay to the check below
    filterMap.addFilterObs(TEST_KEY, new BehaviorSubject<TestRouteParamsFilter>({ day: 'friday' }));

    expect(await firstValueFrom(filterMap.filterForKey(TEST_KEY))).toEqual({
      day: 'friday'
    });
    expect(router.updates).toEqual([]);
  });
});

@Component({
  template: `
    <ng-container dbxFilterMap>
      <ng-container [dbxFilterMapRouteParams]="config()"></ng-container>
    </ng-container>
  `,
  imports: [DbxFilterMapDirective, DbxFilterMapRouteParamsDirective]
})
class TestDbxFilterMapRouteParamsDirectiveComponent {
  readonly config = signal<Maybe<DbxFilterMapRouteParamsConfig<TestRouteParamsFilter>>>(undefined);
  readonly filterMap = viewChild.required<DbxFilterMapDirective<TestRouteParamsFilter>>(DbxFilterMapDirective);
}
