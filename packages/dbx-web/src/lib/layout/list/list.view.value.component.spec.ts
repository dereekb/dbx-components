import { DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION, DbxValueListViewComponent, type DbxValueListViewConfig, DbxValueListViewContentComponent } from './list.view.value.component';
import { type DbxValueListItem, type DbxValueListItemConfig, addConfigToValueListItems, type AbstractDbxValueListViewConfig, dbxValueListItemKeyForItemValue, DbxValueListItemConfigCache, DBX_VALUE_LIST_VIEW_ITEM, injectDbxValueListViewItemSignal } from './list.view.value';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, Injector, input, type OnDestroy, runInInjectionContext, type StaticProvider, type TrackByFunction } from '@angular/core';
import { BehaviorSubject, type Observable, of } from 'rxjs';
import { type ListLoadingStateContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxInjectionComponentConfig, dbxInjectionComponentConfigIsEqual } from '@dereekb/dbx-core';
import { DbxListView, type DbxListSelectionMode } from './list.view';
import { DbxRouterWebProviderConfig } from '../../router/provider/router.provider.config';

import { DbxListTitleGroupDirective } from './group/list.view.value.group.title.directive';
import { type DbxListTitleGroupTitleDelegate, type DbxListTitleGroupData } from './group/list.view.value.group.title';
import { AbstractDbxValueListViewItemComponent } from './list.view.value.item.directive';
import { DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR, type DbxValueListItemSeparatorContext, type DbxValueListViewSeparatorConfig } from './list.view.value.separator';
import { DbxValueListAccordionViewContentComponent } from './accordion/list.accordion.view.component';
import { DbxListViewMetaIconComponent, type DbxListViewMetaIconConfig } from './meta/list.view.meta.icon.component';

// MARK: Test Types
interface TestItem {
  readonly key: string;
  readonly name: string;
  readonly category: string;
}

type TestGroupKey = string;

interface TestGroupData extends DbxListTitleGroupData<TestGroupKey> {
  readonly sort: number;
}

// MARK: Test Item Component
/**
 * Tracks creation and destruction of item component instances for stability assertions.
 */
const TEST_ITEM_INSTANCE_TRACKER = new Map<string, TestItemComponent>();
let testItemDestroyCount = 0;

@Component({
  selector: 'dbx-test-item',
  template: `
    <span class="test-item-name">{{ itemValue.name }}</span>
  `
})
class TestItemComponent extends AbstractDbxValueListViewItemComponent<TestItem> implements OnDestroy {
  constructor() {
    super();
    TEST_ITEM_INSTANCE_TRACKER.set(this.itemValue.key, this);
  }

  ngOnDestroy(): void {
    testItemDestroyCount += 1;
    TEST_ITEM_INSTANCE_TRACKER.delete(this.itemValue.key);
  }
}

// MARK: Test Keyless Item Component
/**
 * Value with no `key` or `id`, so its list items are tracked by position.
 */
interface TestKeylessItem {
  readonly name: string;
}

let testKeylessItemDestroyCount = 0;

/**
 * Copies its name while it is created, so it only renders another item's name if it is re-created.
 */
@Component({
  selector: 'dbx-test-keyless-item',
  template: `
    <span class="test-item-name">{{ name }}</span>
  `
})
class TestKeylessItemComponent extends AbstractDbxValueListViewItemComponent<TestKeylessItem> implements OnDestroy {
  readonly name = this.itemValue.name;

  ngOnDestroy(): void {
    testKeylessItemDestroyCount += 1;
  }
}

// MARK: Test Separator Component
/**
 * Renders the keys of the two items it sits between, using `^` / `$` for a missing leading / trailing item.
 */
@Component({
  selector: 'dbx-test-separator',
  template: `
    <span class="test-separator">{{ label }}</span>
  `
})
class TestSeparatorComponent {
  readonly context = inject<DbxValueListItemSeparatorContext<TestItem>>(DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR);
  readonly label = `${this.context.previous?.itemValue.key ?? '^'}|${this.context.next?.itemValue.key ?? '$'}`;
}

// MARK: Mock DbxListView
class MockDbxListView extends DbxListView<TestItem> {
  readonly disabled$: Observable<boolean> = of(false);
  readonly selectionMode$ = of(undefined);
  readonly values$: Observable<TestItem[]> = of([]);
  readonly trackBy$: Observable<Maybe<TrackByFunction<TestItem>>> = of(undefined);
  clickValue = undefined as any;
  selectionChange = undefined as any;

  setListContext(_state: ListLoadingStateContext<TestItem>): void {
    // noop
  }

  setDisabled(_disabled: boolean): void {
    // noop
  }

  setSelectionMode(_selectionMode: Maybe<DbxListSelectionMode>): void {
    // noop
  }
}

/**
 * Tracks the items by their index instead of their key.
 */
class MockIndexTrackByDbxListView extends MockDbxListView {
  override readonly trackBy$: Observable<Maybe<TrackByFunction<TestItem>>> = of((index: number) => index);
}

/**
 * Emits the values pushed to {@link valuesSubject}, for tests that render through a list view component.
 */
class MockValuesDbxListView extends MockDbxListView {
  readonly valuesSubject = new BehaviorSubject<TestItem[]>([]);
  override readonly values$: Observable<TestItem[]> = this.valuesSubject.asObservable();
}

// MARK: Test Host Component
@Component({
  selector: 'dbx-test-list-host',
  template: `
    <dbx-list-view-content [items]="items()" [separatorConfig]="separatorConfig()"></dbx-list-view-content>
  `,
  imports: [DbxValueListViewContentComponent]
})
class TestListHostComponent {
  readonly items = input<Maybe<DbxValueListItemConfig<TestItem>[]>>();
  readonly separatorConfig = input<Maybe<DbxValueListViewSeparatorConfig<TestItem>>>();
}

// MARK: Test Host With Grouping
@Component({
  selector: 'dbx-test-grouped-list-host',
  template: `
    <dbx-list-view-content [dbxListTitleGroup]="groupDelegate()" [items]="items()" [separatorConfig]="separatorConfig()"></dbx-list-view-content>
  `,
  imports: [DbxValueListViewContentComponent, DbxListTitleGroupDirective]
})
class TestGroupedListHostComponent {
  readonly items = input<Maybe<DbxValueListItemConfig<TestItem>[]>>();
  readonly groupDelegate = input<Maybe<DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData>>>();
  readonly separatorConfig = input<Maybe<DbxValueListViewSeparatorConfig<TestItem>>>();
}

// MARK: Test Host With Accordion Grouping
@Component({
  selector: 'dbx-test-grouped-accordion-host',
  template: `
    <dbx-list-accordion-view-content [dbxListTitleGroup]="groupDelegate()" [items]="items()"></dbx-list-accordion-view-content>
  `,
  imports: [DbxValueListAccordionViewContentComponent, DbxListTitleGroupDirective]
})
class TestGroupedAccordionHostComponent {
  readonly items = input<Maybe<DbxValueListItemConfig<TestItem>[]>>();
  readonly groupDelegate = input<Maybe<DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData>>>();
}

// MARK: Helpers
const TEST_LIST_VIEW_CONFIG: AbstractDbxValueListViewConfig<TestItem> = {
  componentClass: TestItemComponent,
  mapValuesToItemValues: (values) => of(values.map((item) => ({ itemValue: item, key: item.key })))
};

/**
 * Cache shared by the {@link makeConfiguredItems} calls of a test, as a list view directive keeps one for its list.
 */
let testItemConfigCache = new DbxValueListItemConfigCache<TestItem>();

/**
 * Creates configured list items from raw test items.
 */
function makeConfiguredItems(items: TestItem[]): DbxValueListItemConfig<TestItem>[] {
  const listItems: DbxValueListItem<TestItem>[] = items.map((item) => ({
    key: item.key,
    itemValue: item
  }));

  return addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, listItems, testItemConfigCache);
}

const TEST_KEYLESS_LIST_VIEW_CONFIG: AbstractDbxValueListViewConfig<TestKeylessItem> = {
  componentClass: TestKeylessItemComponent,
  mapValuesToItemValues: (values) => of(values.map((item) => ({ itemValue: item }) as DbxValueListItem<TestKeylessItem>))
};

let testKeylessItemConfigCache = new DbxValueListItemConfigCache<TestKeylessItem>();

/**
 * Creates configured list items without keys from raw keyless test items.
 */
function makeConfiguredKeylessItems(items: TestKeylessItem[]): DbxValueListItemConfig<TestKeylessItem>[] {
  const listItems = items.map((item) => ({ itemValue: item }) as DbxValueListItem<TestKeylessItem>);
  return addConfigToValueListItems(TEST_KEYLESS_LIST_VIEW_CONFIG, listItems, testKeylessItemConfigCache);
}

/**
 * Returns the rendered item names, in document order.
 */
function renderedItemNames(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.test-item-name')).map((x) => x.textContent ?? '');
}

/**
 * Returns the rendered group header titles, in document order.
 */
function renderedGroupHeaderTitles(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.dbx-list-title-group-header .mat-subtitle-2')).map((x) => x.textContent ?? '');
}

/**
 * Creates a group delegate that groups by category and counts the group's items in its title.
 */
function makeCountingTestGroupDelegate(): DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData> {
  const result: DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData> = {
    groupValueForItem: (item) => item.itemValue.category,
    dataForGroupValue: (value, items) => ({
      value,
      title: `${value} (${items.length})`,
      sort: value === 'alpha' ? 0 : 1
    }),
    sortGroupsByData: (a, b) => a.sort - b.sort
  };

  return result;
}

/**
 * Creates a group delegate for test items that groups by category.
 */
function makeTestGroupDelegate(): DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData> {
  const result: DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData> = {
    groupValueForItem: (item) => item.itemValue.category,
    dataForGroupValue: (value) => ({
      value,
      title: `Category: ${value}`,
      sort: value === 'alpha' ? 0 : 1
    }),
    sortGroupsByData: (a, b) => a.sort - b.sort
  };

  return result;
}

const MOCK_ROUTER_WEB_PROVIDER_CONFIG: DbxRouterWebProviderConfig = {
  anchorSegueRefComponent: { componentClass: TestItemComponent }
};

// MARK: Tests
describe('dbxValueListItemKeyForItemValue', () => {
  it('should use key from a ModelKeyRef value', () => {
    expect(dbxValueListItemKeyForItemValue({ key: 'model-key', name: 'test' }, 0)).toBe('model-key');
  });

  it('should use id from a UniqueModel value', () => {
    expect(dbxValueListItemKeyForItemValue({ id: 'model-id', name: 'test' }, 0)).toBe('model-id');
  });

  it('should prefer key over id', () => {
    expect(dbxValueListItemKeyForItemValue({ key: 'model-key', id: 'model-id' }, 0)).toBe('model-key');
  });

  it('should fall back to a prefixed index when no key or id is available', () => {
    expect(dbxValueListItemKeyForItemValue({ name: 'test' }, 3)).toBe('__i_3');
  });

  it('should produce different fallback values for different indexes', () => {
    const result0 = dbxValueListItemKeyForItemValue({ name: 'test' }, 0);
    const result1 = dbxValueListItemKeyForItemValue({ name: 'test' }, 1);
    expect(result0).not.toBe(result1);
  });
});

describe('DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION', () => {
  interface TestValue {
    readonly name: string;
  }

  it('should return the item key', () => {
    const item: DbxValueListItem<TestValue> = {
      key: 'explicit-key',
      itemValue: { name: 'test' }
    };

    const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
    expect(result).toBe('explicit-key');
  });

  it('should return the same tracking key for items with the same key but different data', () => {
    const itemBefore: DbxValueListItem<TestValue> = {
      key: 'stable-key',
      itemValue: { name: 'before' }
    };

    const itemAfter: DbxValueListItem<TestValue> = {
      key: 'stable-key',
      itemValue: { name: 'after' }
    };

    const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
    const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

    expect(resultBefore).toBe(resultAfter);
  });
});

describe('DbxValueListViewContentComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListHostComponent, TestGroupedListHostComponent, TestGroupedAccordionHostComponent, TestItemComponent, TestKeylessItemComponent, TestSeparatorComponent],
      providers: [
        { provide: DbxListView, useClass: MockDbxListView },
        { provide: DbxRouterWebProviderConfig, useValue: MOCK_ROUTER_WEB_PROVIDER_CONFIG }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    TEST_ITEM_INSTANCE_TRACKER.clear();
    testItemDestroyCount = 0;
    testKeylessItemDestroyCount = 0;
    testItemConfigCache = new DbxValueListItemConfigCache<TestItem>();
    testKeylessItemConfigCache = new DbxValueListItemConfigCache<TestKeylessItem>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('item stability across data updates', () => {
    let fixture: ComponentFixture<TestListHostComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestListHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should render configured items', async () => {
      const items: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(items));
      fixture.detectChanges();
      await fixture.whenStable();

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(2);
      expect(itemElements[0].textContent).toBe('Alpha');
      expect(itemElements[1].textContent).toBe('Beta');
    });

    it('should NOT destroy item components when data updates with same keys', async () => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha Before', category: 'first' },
        { key: 'b', name: 'Beta Before', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      // Capture the original component instances
      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceB1 = TEST_ITEM_INSTANCE_TRACKER.get('b');

      expect(instanceA1).toBeDefined();
      expect(instanceB1).toBeDefined();

      // Reset destroy counter before the update
      testItemDestroyCount = 0;

      // Simulate a data update: new object references but same keys
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha After', category: 'first' },
        { key: 'b', name: 'Beta After', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      // No item components should have been destroyed since the keys are stable
      expect(testItemDestroyCount).toBe(0);

      // The same component instances should still be tracked
      const instanceA2 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceB2 = TEST_ITEM_INSTANCE_TRACKER.get('b');

      expect(instanceA2).toBe(instanceA1);
      expect(instanceB2).toBe(instanceB1);

      // The kept components should render the updated items
      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(Array.from(itemElements).map((x) => (x as HTMLElement).textContent)).toEqual(['Alpha After', 'Beta After']);
    });

    it('should destroy and recreate only the removed item when one item is removed', async () => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' },
        { key: 'c', name: 'Charlie', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceC1 = TEST_ITEM_INSTANCE_TRACKER.get('c');

      expect(instanceA1).toBeDefined();
      expect(instanceC1).toBeDefined();

      testItemDestroyCount = 0;

      // Remove 'b', keep 'a' and 'c'
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'c', name: 'Charlie', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      // Only the removed item 'b' should have been destroyed
      expect(testItemDestroyCount).toBe(1);

      // Remaining items should keep their instances
      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('c')).toBe(instanceC1);
      expect(TEST_ITEM_INSTANCE_TRACKER.has('b')).toBe(false);
    });

    it('should reuse item components when items are reordered', async () => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' },
        { key: 'c', name: 'Charlie', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceB1 = TEST_ITEM_INSTANCE_TRACKER.get('b');
      const instanceC1 = TEST_ITEM_INSTANCE_TRACKER.get('c');

      testItemDestroyCount = 0;

      // Reorder: c, a, b
      const itemsAfter: TestItem[] = [
        { key: 'c', name: 'Charlie', category: 'first' },
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      // No items should be destroyed during a reorder with stable keys
      expect(testItemDestroyCount).toBe(0);

      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('c')).toBe(instanceC1);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Charlie', 'Alpha', 'Beta']);
    });

    it('should render the updated items when items are reordered and their data changes', async () => {
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha', category: 'first' },
          { key: 'b', name: 'Beta', category: 'first' },
          { key: 'c', name: 'Charlie', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      testItemDestroyCount = 0;

      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'c', name: 'Charlie Updated', category: 'first' },
          { key: 'a', name: 'Alpha Updated', category: 'first' },
          { key: 'b', name: 'Beta Updated', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(testItemDestroyCount).toBe(0);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Charlie Updated', 'Alpha Updated', 'Beta Updated']);
    });
  });

  describe('rows re-used for another key', () => {
    let fixture: ComponentFixture<TestListHostComponent>;

    beforeEach(() => {
      // a trackBy that ignores the keys makes the list re-use its rows by position
      TestBed.overrideProvider(DbxListView, { useValue: new MockIndexTrackByDbxListView() });
      fixture = TestBed.createComponent(TestListHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should re-create the item component when a re-used row moves to an item with another key', async () => {
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha', category: 'first' },
          { key: 'b', name: 'Beta', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');

      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'b', name: 'Beta', category: 'first' },
          { key: 'a', name: 'Alpha', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Beta', 'Alpha']);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).not.toBe(instanceA1);
    });
  });

  describe('items without keys', () => {
    let fixture: ComponentFixture<TestListHostComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestListHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should re-create the item components when items without keys are reordered', async () => {
      const alpha: TestKeylessItem = { name: 'Alpha' };
      const beta: TestKeylessItem = { name: 'Beta' };

      fixture.componentRef.setInput('items', makeConfiguredKeylessItems([alpha, beta]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Beta']);

      fixture.componentRef.setInput('items', makeConfiguredKeylessItems([beta, alpha]));
      fixture.detectChanges();
      await fixture.whenStable();

      // the components copy their name while they are created, so the names only follow the new order if they were re-created
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Beta', 'Alpha']);
      expect(testKeylessItemDestroyCount).toBe(2);
    });

    it('should keep the item components of items without keys while their values stay the same', async () => {
      const alpha: TestKeylessItem = { name: 'Alpha' };
      const beta: TestKeylessItem = { name: 'Beta' };

      fixture.componentRef.setInput('items', makeConfiguredKeylessItems([alpha, beta]));
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput('items', makeConfiguredKeylessItems([alpha, beta]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(testKeylessItemDestroyCount).toBe(0);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Beta']);
    });

    it('should render every item when items repeat a key', async () => {
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'x', name: 'Alpha', category: 'first' },
          { key: 'x', name: 'Beta', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Beta']);

      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'x', name: 'Beta', category: 'first' },
          { key: 'x', name: 'Alpha', category: 'first' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Beta', 'Alpha']);
    });
  });

  describe('grouped list with DbxListTitleGroupDirective', () => {
    let fixture: ComponentFixture<TestGroupedListHostComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestGroupedListHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should render items grouped by category', async () => {
      const items: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' },
        { key: 'c', name: 'Charlie', category: 'alpha' }
      ];

      const delegate = makeTestGroupDelegate();

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(items));
      fixture.detectChanges();
      await fixture.whenStable();

      const groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(3);
    });

    it('should NOT destroy item components when grouped data updates with same keys', async () => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha Before', category: 'alpha' },
        { key: 'b', name: 'Beta Before', category: 'beta' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceB1 = TEST_ITEM_INSTANCE_TRACKER.get('b');

      expect(instanceA1).toBeDefined();
      expect(instanceB1).toBeDefined();

      testItemDestroyCount = 0;

      // Simulate Firestore update: same keys, new object references
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha After', category: 'alpha' },
        { key: 'b', name: 'Beta After', category: 'beta' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      // Items should NOT be destroyed and recreated
      expect(testItemDestroyCount).toBe(0);

      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha After', 'Beta After']);
    });

    it('should update the group header titles when items move between groups', async () => {
      fixture.componentRef.setInput('groupDelegate', makeCountingTestGroupDelegate());
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha', category: 'alpha' },
          { key: 'b', name: 'Beta', category: 'beta' },
          { key: 'c', name: 'Charlie', category: 'alpha' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedGroupHeaderTitles(fixture.nativeElement)).toEqual(['alpha (2)', 'beta (1)']);

      // move 'c' from alpha to beta
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha', category: 'alpha' },
          { key: 'b', name: 'Beta', category: 'beta' },
          { key: 'c', name: 'Charlie', category: 'beta' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedGroupHeaderTitles(fixture.nativeElement)).toEqual(['alpha (1)', 'beta (2)']);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Beta', 'Charlie']);
    });

    it('should properly re-group items when an item moves between categories', async () => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' },
        { key: 'c', name: 'Charlie', category: 'alpha' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      let groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      // Move 'c' from alpha to beta
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' },
        { key: 'c', name: 'Charlie', category: 'beta' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      // Verify total items still rendered
      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(3);
    });

    it('should collapse to one group when all items move to the same category', async () => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      await fixture.whenStable();

      let groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      // Move all items to 'alpha'
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'alpha' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      await fixture.whenStable();

      groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(1);

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(2);
    });
  });

  describe('grouped accordion list with DbxListTitleGroupDirective', () => {
    let fixture: ComponentFixture<TestGroupedAccordionHostComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestGroupedAccordionHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should update the group header titles and items when items change and move between groups', async () => {
      fixture.componentRef.setInput('groupDelegate', makeCountingTestGroupDelegate());
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha', category: 'alpha' },
          { key: 'b', name: 'Beta', category: 'beta' },
          { key: 'c', name: 'Charlie', category: 'alpha' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedGroupHeaderTitles(fixture.nativeElement)).toEqual(['alpha (2)', 'beta (1)']);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Charlie', 'Beta']);

      const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');

      // update 'a' in place, and move 'c' from alpha to beta
      fixture.componentRef.setInput(
        'items',
        makeConfiguredItems([
          { key: 'a', name: 'Alpha Updated', category: 'alpha' },
          { key: 'b', name: 'Beta', category: 'beta' },
          { key: 'c', name: 'Charlie', category: 'beta' }
        ])
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedGroupHeaderTitles(fixture.nativeElement)).toEqual(['alpha (1)', 'beta (2)']);
      expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha Updated', 'Beta', 'Charlie']);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
    });
  });

  describe('separators', () => {
    /**
     * Returns the rendered separator labels and item names, in document order.
     */
    function renderedSequence(element: HTMLElement): string[] {
      return Array.from(element.querySelectorAll('.test-separator, .test-item-name')).map((x) => x.textContent ?? '');
    }

    describe('ungrouped list', () => {
      let fixture: ComponentFixture<TestListHostComponent>;

      beforeEach(() => {
        fixture = TestBed.createComponent(TestListHostComponent);
      });

      afterEach(() => {
        fixture.destroy();
      });

      it('should not render separators when no separator config is set', async () => {
        const items: TestItem[] = [
          { key: 'a', name: 'Alpha', category: 'first' },
          { key: 'b', name: 'Beta', category: 'second' }
        ];

        fixture.componentRef.setInput('items', makeConfiguredItems(items));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelectorAll('.dbx-list-view-item-separator').length).toBe(0);
      });

      it('should render a separator only between the items showSeparator approves', async () => {
        const items: TestItem[] = [
          { key: 'a', name: 'Alpha', category: 'first' },
          { key: 'b', name: 'Beta', category: 'first' },
          { key: 'c', name: 'Charlie', category: 'second' }
        ];

        const separatorConfig: DbxValueListViewSeparatorConfig<TestItem> = {
          componentClass: TestSeparatorComponent,
          showSeparator: (previous, next) => previous != null && next != null && previous.itemValue.category !== next.itemValue.category
        };

        fixture.componentRef.setInput('separatorConfig', separatorConfig);
        fixture.componentRef.setInput('items', makeConfiguredItems(items));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(renderedSequence(fixture.nativeElement)).toEqual(['Alpha', 'Beta', 'b|c', 'Charlie']);
      });

      it('should call showSeparator for the leading and trailing positions with the missing side undefined', async () => {
        const items: TestItem[] = [
          { key: 'a', name: 'Alpha', category: 'first' },
          { key: 'b', name: 'Beta', category: 'first' }
        ];

        const calls: string[] = [];
        const separatorConfig: DbxValueListViewSeparatorConfig<TestItem> = {
          componentClass: TestSeparatorComponent,
          showSeparator: (previous, next) => {
            calls.push(`${previous?.itemValue.key ?? '^'}|${next?.itemValue.key ?? '$'}`);
            return true;
          }
        };

        fixture.componentRef.setInput('separatorConfig', separatorConfig);
        fixture.componentRef.setInput('items', makeConfiguredItems(items));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(calls).toContain('^|a');
        expect(calls).toContain('a|b');
        expect(calls).toContain('b|$');
        expect(renderedSequence(fixture.nativeElement)).toEqual(['^|a', 'Alpha', 'a|b', 'Beta', 'b|$']);
      });

      it('should update a separator when its neighbouring items change', async () => {
        const separatorConfig: DbxValueListViewSeparatorConfig<TestItem> = {
          componentClass: TestSeparatorComponent,
          showSeparator: (previous, next) => previous != null && next != null
        };

        fixture.componentRef.setInput('separatorConfig', separatorConfig);
        fixture.componentRef.setInput(
          'items',
          makeConfiguredItems([
            { key: 'a', name: 'Alpha', category: 'first' },
            { key: 'b', name: 'Beta', category: 'first' }
          ])
        );
        fixture.detectChanges();
        await fixture.whenStable();

        expect(renderedSequence(fixture.nativeElement)).toEqual(['Alpha', 'a|b', 'Beta']);

        // insert 'c' between 'a' and 'b'; the separator in front of the reused 'b' row must now read c|b
        fixture.componentRef.setInput(
          'items',
          makeConfiguredItems([
            { key: 'a', name: 'Alpha', category: 'first' },
            { key: 'c', name: 'Charlie', category: 'first' },
            { key: 'b', name: 'Beta', category: 'first' }
          ])
        );
        fixture.detectChanges();
        await fixture.whenStable();

        expect(renderedSequence(fixture.nativeElement)).toEqual(['Alpha', 'a|c', 'Charlie', 'c|b', 'Beta']);
      });

      it('should NOT destroy item components when data updates with same keys and separators are shown', async () => {
        const separatorConfig: DbxValueListViewSeparatorConfig<TestItem> = {
          componentClass: TestSeparatorComponent,
          showSeparator: (previous, next) => previous != null && next != null
        };

        fixture.componentRef.setInput('separatorConfig', separatorConfig);
        fixture.componentRef.setInput(
          'items',
          makeConfiguredItems([
            { key: 'a', name: 'Alpha Before', category: 'first' },
            { key: 'b', name: 'Beta Before', category: 'first' }
          ])
        );
        fixture.detectChanges();
        await fixture.whenStable();

        const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
        const instanceB1 = TEST_ITEM_INSTANCE_TRACKER.get('b');
        testItemDestroyCount = 0;

        fixture.componentRef.setInput(
          'items',
          makeConfiguredItems([
            { key: 'a', name: 'Alpha After', category: 'first' },
            { key: 'b', name: 'Beta After', category: 'first' }
          ])
        );
        fixture.detectChanges();
        await fixture.whenStable();

        expect(testItemDestroyCount).toBe(0);
        expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
        expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
        // the reused item components render the updated items; the separator is still rendered between them.
        expect(renderedSequence(fixture.nativeElement)).toEqual(['Alpha After', 'a|b', 'Beta After']);
      });
    });

    describe('grouped list', () => {
      let fixture: ComponentFixture<TestGroupedListHostComponent>;

      beforeEach(() => {
        fixture = TestBed.createComponent(TestGroupedListHostComponent);
      });

      afterEach(() => {
        fixture.destroy();
      });

      it('should evaluate separators within each group', async () => {
        const items: TestItem[] = [
          { key: 'a', name: 'Alpha', category: 'alpha' },
          { key: 'b', name: 'Beta', category: 'beta' },
          { key: 'c', name: 'Charlie', category: 'alpha' }
        ];

        const separatorConfig: DbxValueListViewSeparatorConfig<TestItem> = {
          componentClass: TestSeparatorComponent,
          showSeparator: (previous, next) => previous != null && next != null
        };

        fixture.componentRef.setInput('groupDelegate', makeTestGroupDelegate());
        fixture.componentRef.setInput('separatorConfig', separatorConfig);
        fixture.componentRef.setInput('items', makeConfiguredItems(items));
        fixture.detectChanges();
        await fixture.whenStable();

        // alpha group renders [a, c] and beta group renders [b]; only a|c are neighbours within a group.
        expect(renderedSequence(fixture.nativeElement)).toEqual(['Alpha', 'a|c', 'Charlie', 'Beta']);
      });
    });
  });
});

// MARK: Item Config Cache
/**
 * Returns the item signal a component created from the input config injects.
 */
function itemSignalForConfig<T>(config: DbxInjectionComponentConfig, parent?: Injector) {
  const injector = Injector.create({ providers: config.providers as StaticProvider[], parent });
  return runInInjectionContext(injector, () => injectDbxValueListViewItemSignal<DbxValueListItem<T>>());
}

describe('DbxValueListItemConfigCache', () => {
  const alpha: TestItem = { key: 'a', name: 'Alpha', category: 'first' };
  const beta: TestItem = { key: 'b', name: 'Beta', category: 'first' };

  let cache: DbxValueListItemConfigCache<TestItem>;

  beforeEach(() => {
    cache = new DbxValueListItemConfigCache<TestItem>();
  });

  it('should return the same configs for a key and set the new item on its item signal', () => {
    const [first] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);
    const itemSignal = itemSignalForConfig<TestItem>(first.config);
    expect(itemSignal()).toBe(first);

    const [second] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: { ...alpha, name: 'Alpha Updated' } }]);
    expect(second.config).toBe(first.config);
    expect(itemSignal()).toBe(second);
    expect(itemSignal().itemValue.name).toBe('Alpha Updated');
  });

  it('should make configs for each key that dbx-injection does not find equal', () => {
    const [a, b] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [
      { key: 'a', itemValue: alpha },
      { key: 'b', itemValue: beta }
    ]);

    expect(dbxInjectionComponentConfigIsEqual(a.config, b.config)).toBe(false);
  });

  it('should make new configs when the list view config changes', () => {
    const [first] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);
    const [second] = cache.addConfigToValueListItems({ ...TEST_LIST_VIEW_CONFIG }, [{ key: 'a', itemValue: alpha }]);

    expect(second.config).not.toBe(first.config);
  });

  it('should make new configs for a key that left the list and came back', () => {
    const [first] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);
    cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'b', itemValue: beta }]);
    const [third] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);

    expect(third.config).not.toBe(first.config);
  });

  it("should use the item value's key when the item has no key", () => {
    const [item] = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ itemValue: alpha } as DbxValueListItem<TestItem>]);
    expect(item.key).toBe('a');
  });

  it('should give a positional key to items without a key', () => {
    const keylessCache = new DbxValueListItemConfigCache<TestKeylessItem>();
    const items = keylessCache.addConfigToValueListItems(TEST_KEYLESS_LIST_VIEW_CONFIG, [{ itemValue: { name: 'Alpha' } } as DbxValueListItem<TestKeylessItem>, { itemValue: { name: 'Beta' } } as DbxValueListItem<TestKeylessItem>]);
    expect(items.map((x) => x.key)).toEqual(['__i_0', '__i_1']);
  });

  it('should give a unique key to items that repeat a key', () => {
    const items = cache.addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [
      { key: 'x', itemValue: alpha },
      { key: 'x', itemValue: beta },
      { key: 'x__i_1', itemValue: { ...beta, key: 'c' } }
    ]);

    const keys = items.map((x) => x.key);
    expect(keys.slice(0, 2)).toEqual(['x', 'x__i_1']);
    expect(new Set(keys).size).toBe(3);
  });

  it('should make new configs for an item without a key when its item value changes', () => {
    const keylessCache = new DbxValueListItemConfigCache<TestKeylessItem>();
    const value: TestKeylessItem = { name: 'Alpha' };

    const [first] = keylessCache.addConfigToValueListItems(TEST_KEYLESS_LIST_VIEW_CONFIG, [{ itemValue: value } as DbxValueListItem<TestKeylessItem>]);
    const [second] = keylessCache.addConfigToValueListItems(TEST_KEYLESS_LIST_VIEW_CONFIG, [{ itemValue: value } as DbxValueListItem<TestKeylessItem>]);
    const [third] = keylessCache.addConfigToValueListItems(TEST_KEYLESS_LIST_VIEW_CONFIG, [{ itemValue: { name: 'Beta' } } as DbxValueListItem<TestKeylessItem>]);

    expect(second.config).toBe(first.config);
    expect(third.config).not.toBe(first.config);
  });
});

describe('addConfigToValueListItems()', () => {
  it('should make new configs on each call when no cache is passed', () => {
    const alpha: TestItem = { key: 'a', name: 'Alpha', category: 'first' };

    const [first] = addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);
    const [second] = addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: alpha }]);

    expect(dbxInjectionComponentConfigIsEqual(first.config, second.config)).toBe(false);
  });
});

describe('injectDbxValueListViewItemSignal()', () => {
  const manualItem: DbxValueListItem<TestItem> = { key: 'manual', itemValue: { key: 'manual', name: 'Manual', category: 'first' } };

  it('should return a signal of an item that is provided by hand', () => {
    const itemSignal = itemSignalForConfig<TestItem>({ componentClass: TestItemComponent, providers: [{ provide: DBX_VALUE_LIST_VIEW_ITEM, useValue: manualItem }] });
    expect(itemSignal()).toBe(manualItem);
  });

  it('should not return the signal of an outer list item for an item that is provided by hand', () => {
    const [outerItem] = new DbxValueListItemConfigCache<TestItem>().addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, [{ key: 'a', itemValue: { key: 'a', name: 'Alpha', category: 'first' } }]);
    const outerInjector = Injector.create({ providers: outerItem.config.providers as StaticProvider[] });

    const itemSignal = itemSignalForConfig<TestItem>({ componentClass: TestItemComponent, providers: [{ provide: DBX_VALUE_LIST_VIEW_ITEM, useValue: manualItem }] }, outerInjector);
    expect(itemSignal()).toBe(manualItem);
  });

  it('should return undefined when optional and no item is provided', () => {
    const result = runInInjectionContext(Injector.create({ providers: [] }), () => injectDbxValueListViewItemSignal({ optional: true }));
    expect(result).toBeUndefined();
  });
});

// MARK: DbxValueListViewComponent
@Component({
  selector: 'dbx-test-list-view-host',
  template: `
    <dbx-list-view [config]="config()"></dbx-list-view>
  `,
  imports: [DbxValueListViewComponent]
})
class TestListViewHostComponent {
  readonly config = input.required<DbxValueListViewConfig<TestItem>>();
}

describe('DbxValueListViewComponent', () => {
  let listView: MockValuesDbxListView;
  let fixture: ComponentFixture<TestListViewHostComponent>;

  beforeEach(async () => {
    listView = new MockValuesDbxListView();

    await TestBed.configureTestingModule({
      imports: [TestListViewHostComponent],
      providers: [
        { provide: DbxListView, useValue: listView },
        { provide: DbxRouterWebProviderConfig, useValue: MOCK_ROUTER_WEB_PROVIDER_CONFIG }
      ]
    }).compileComponents();

    TEST_ITEM_INSTANCE_TRACKER.clear();
    testItemDestroyCount = 0;
    fixture = TestBed.createComponent(TestListViewHostComponent);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  /**
   * Pushes the values to the list view and renders them.
   */
  async function setValues(values: TestItem[]): Promise<void> {
    listView.valuesSubject.next(values);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should keep the item components and render the updated items when the values update and reorder', async () => {
    fixture.componentRef.setInput('config', TEST_LIST_VIEW_CONFIG);

    await setValues([
      { key: 'a', name: 'Alpha', category: 'first' },
      { key: 'b', name: 'Beta', category: 'first' }
    ]);

    expect(renderedItemNames(fixture.nativeElement)).toEqual(['Alpha', 'Beta']);
    const instanceA1 = TEST_ITEM_INSTANCE_TRACKER.get('a');
    const instanceB1 = TEST_ITEM_INSTANCE_TRACKER.get('b');

    await setValues([
      { key: 'b', name: 'Beta Updated', category: 'first' },
      { key: 'a', name: 'Alpha Updated', category: 'first' }
    ]);

    expect(renderedItemNames(fixture.nativeElement)).toEqual(['Beta Updated', 'Alpha Updated']);
    expect(testItemDestroyCount).toBe(0);
    expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
    expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
  });

  it('should update the meta icon when the item meta changes', async () => {
    const config: DbxValueListViewConfig<TestItem, DbxValueListItem<TestItem, DbxListViewMetaIconConfig>> = {
      componentClass: TestItemComponent,
      mapValuesToItemValues: (values) => of(values.map((item) => ({ itemValue: item, key: item.key, meta: { icon: item.category } }))),
      metaConfig: DbxListViewMetaIconComponent.metaConfig('chevron_right')
    };

    fixture.componentRef.setInput('config', config);
    await setValues([{ key: 'a', name: 'Alpha', category: 'star' }]);

    const metaIconText = () => Array.from(fixture.nativeElement.querySelectorAll('.dbx-list-view-meta-icon')).map((x) => (x as HTMLElement).textContent?.trim());
    expect(metaIconText()).toEqual(['star']);

    await setValues([{ key: 'a', name: 'Alpha', category: 'check' }]);
    expect(metaIconText()).toEqual(['check']);
  });
});
