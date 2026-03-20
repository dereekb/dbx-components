import { DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION, DbxValueListViewContentComponent } from './list.view.value.component';
import { type DbxValueListItem, type DbxValueListItemConfig, addConfigToValueListItems, type AbstractDbxValueListViewConfig } from './list.view.value';
import { type ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, input, type OnDestroy } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { type ListLoadingStateContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxListView, type DbxListSelectionMode } from './list.view';
import { DbxRouterWebProviderConfig } from '../../router/provider/router.provider.config';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DbxListTitleGroupDirective } from './group/list.view.value.group.title.directive';
import { type DbxListTitleGroupTitleDelegate, type DbxListTitleGroupData } from './group/list.view.value.group.title';
import { AbstractDbxValueListViewItemComponent } from './list.view.value.item.directive';

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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

// MARK: Mock DbxListView
class MockDbxListView extends DbxListView<TestItem> {
  readonly disabled$: Observable<boolean> = of(false);
  readonly selectionMode$ = of(undefined);
  readonly values$: Observable<TestItem[]> = of([]);
  readonly trackBy$ = of(undefined);
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

// MARK: Test Host Component
@Component({
  selector: 'dbx-test-list-host',
  template: `
    <dbx-list-view-content [items]="items()"></dbx-list-view-content>
  `,
  standalone: true,
  imports: [DbxValueListViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestListHostComponent {
  readonly items = input<Maybe<DbxValueListItemConfig<TestItem>[]>>();
}

// MARK: Test Host With Grouping
@Component({
  selector: 'dbx-test-grouped-list-host',
  template: `
    <dbx-list-view-content [dbxListTitleGroup]="groupDelegate()" [items]="items()"></dbx-list-view-content>
  `,
  standalone: true,
  imports: [DbxValueListViewContentComponent, DbxListTitleGroupDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestGroupedListHostComponent {
  readonly items = input<Maybe<DbxValueListItemConfig<TestItem>[]>>();
  readonly groupDelegate = input<Maybe<DbxListTitleGroupTitleDelegate<TestItem, TestGroupKey, TestGroupData>>>();
}

// MARK: Helpers
const TEST_LIST_VIEW_CONFIG: AbstractDbxValueListViewConfig<TestItem> = {
  componentClass: TestItemComponent
};

/**
 * Creates configured list items from raw test items.
 */
function makeConfiguredItems(items: TestItem[]): DbxValueListItemConfig<TestItem>[] {
  const listItems: DbxValueListItem<TestItem>[] = items.map((item) => ({
    key: item.key,
    itemValue: item
  }));

  return addConfigToValueListItems(TEST_LIST_VIEW_CONFIG, listItems);
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
describe('DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION', () => {
  interface TestValue {
    readonly name: string;
  }

  interface TestValueWithKey {
    readonly key: string;
    readonly name: string;
  }

  interface TestValueWithId {
    readonly id: string;
    readonly name: string;
  }

  describe('with item.key set', () => {
    it('should use the item key', () => {
      const item: DbxValueListItem<TestValue> = {
        key: 'explicit-key',
        itemValue: { name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });

    it('should prefer item.key over itemValue.key', () => {
      const item: DbxValueListItem<TestValueWithKey> = {
        key: 'explicit-key',
        itemValue: { key: 'value-key', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });

    it('should prefer item.key over itemValue.id', () => {
      const item: DbxValueListItem<TestValueWithId> = {
        key: 'explicit-key',
        itemValue: { id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });
  });

  describe('with itemValue.key', () => {
    it('should use itemValue.key when item.key is not set', () => {
      const item: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'value-key', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-key');
    });

    it('should prefer itemValue.key over itemValue.id', () => {
      const item: DbxValueListItem<TestValueWithKey & TestValueWithId> = {
        itemValue: { key: 'value-key', id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-key');
    });
  });

  describe('with itemValue.id', () => {
    it('should use itemValue.id when neither item.key nor itemValue.key is set', () => {
      const item: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-id');
    });
  });

  describe('index fallback', () => {
    it('should fall back to a prefixed index when no key or id is available', () => {
      const item: DbxValueListItem<TestValue> = {
        itemValue: { name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(3, item);
      expect(result).toBe('__list__3__');
    });

    it('should produce different fallback values for different indexes', () => {
      const item: DbxValueListItem<TestValue> = {
        itemValue: { name: 'test' }
      };

      const result0 = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      const result1 = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(1, item);

      expect(result0).not.toBe(result1);
    });
  });

  describe('stability across data updates', () => {
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

    it('should return the same tracking key for items with the same itemValue.key but different object references', () => {
      const itemBefore: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'model-key', name: 'before' }
      };

      const itemAfter: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'model-key', name: 'after' }
      };

      const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
      const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

      expect(resultBefore).toBe(resultAfter);
    });

    it('should return the same tracking key for items with the same itemValue.id but different object references', () => {
      const itemBefore: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'model-id', name: 'before' }
      };

      const itemAfter: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'model-id', name: 'after' }
      };

      const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
      const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

      expect(resultBefore).toBe(resultAfter);
    });
  });
});

describe('DbxValueListViewContentComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListHostComponent, TestGroupedListHostComponent, TestItemComponent],
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      providers: [provideNoopAnimations(), { provide: DbxListView, useClass: MockDbxListView }, { provide: DbxRouterWebProviderConfig, useValue: MOCK_ROUTER_WEB_PROVIDER_CONFIG }]
    }).compileComponents();
  });

  beforeEach(() => {
    TEST_ITEM_INSTANCE_TRACKER.clear();
    testItemDestroyCount = 0;
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

    it('should render configured items', fakeAsync(() => {
      const items: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(items));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(2);
      expect(itemElements[0].textContent).toBe('Alpha');
      expect(itemElements[1].textContent).toBe('Beta');
    }));

    it('should NOT destroy item components when data updates with same keys', fakeAsync(() => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha Before', category: 'first' },
        { key: 'b', name: 'Beta Before', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

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
      tick();
      fixture.detectChanges();

      // No item components should have been destroyed since the keys are stable
      expect(testItemDestroyCount).toBe(0);

      // The same component instances should still be tracked
      const instanceA2 = TEST_ITEM_INSTANCE_TRACKER.get('a');
      const instanceB2 = TEST_ITEM_INSTANCE_TRACKER.get('b');

      expect(instanceA2).toBe(instanceA1);
      expect(instanceB2).toBe(instanceB1);
    }));

    it('should destroy and recreate only the removed item when one item is removed', fakeAsync(() => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' },
        { key: 'c', name: 'Charlie', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

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
      tick();
      fixture.detectChanges();

      // Only the removed item 'b' should have been destroyed
      expect(testItemDestroyCount).toBe(1);

      // Remaining items should keep their instances
      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('c')).toBe(instanceC1);
      expect(TEST_ITEM_INSTANCE_TRACKER.has('b')).toBe(false);
    }));

    it('should reuse item components when items are reordered', fakeAsync(() => {
      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'first' },
        { key: 'b', name: 'Beta', category: 'first' },
        { key: 'c', name: 'Charlie', category: 'first' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

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
      tick();
      fixture.detectChanges();

      // No items should be destroyed during a reorder with stable keys
      expect(testItemDestroyCount).toBe(0);

      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('c')).toBe(instanceC1);
    }));
  });

  describe('grouped list with DbxListTitleGroupDirective', () => {
    let fixture: ComponentFixture<TestGroupedListHostComponent>;

    beforeEach(() => {
      fixture = TestBed.createComponent(TestGroupedListHostComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should render items grouped by category', fakeAsync(() => {
      const items: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' },
        { key: 'c', name: 'Charlie', category: 'alpha' }
      ];

      const delegate = makeTestGroupDelegate();

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(items));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(3);
    }));

    it('should NOT destroy item components when grouped data updates with same keys', fakeAsync(() => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha Before', category: 'alpha' },
        { key: 'b', name: 'Beta Before', category: 'beta' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

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
      tick();
      fixture.detectChanges();

      // Items should NOT be destroyed and recreated
      expect(testItemDestroyCount).toBe(0);

      expect(TEST_ITEM_INSTANCE_TRACKER.get('a')).toBe(instanceA1);
      expect(TEST_ITEM_INSTANCE_TRACKER.get('b')).toBe(instanceB1);
    }));

    it('should properly re-group items when an item moves between categories', fakeAsync(() => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' },
        { key: 'c', name: 'Charlie', category: 'alpha' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

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
      tick();
      fixture.detectChanges();

      groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      // Verify total items still rendered
      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(3);
    }));

    it('should collapse to one group when all items move to the same category', fakeAsync(() => {
      const delegate = makeTestGroupDelegate();

      const itemsBefore: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'beta' }
      ];

      fixture.componentRef.setInput('groupDelegate', delegate);
      fixture.componentRef.setInput('items', makeConfiguredItems(itemsBefore));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      let groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(2);

      // Move all items to 'alpha'
      const itemsAfter: TestItem[] = [
        { key: 'a', name: 'Alpha', category: 'alpha' },
        { key: 'b', name: 'Beta', category: 'alpha' }
      ];

      fixture.componentRef.setInput('items', makeConfiguredItems(itemsAfter));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      groupElements = fixture.nativeElement.querySelectorAll('dbx-list-view-content-group');
      expect(groupElements.length).toBe(1);

      const itemElements = fixture.nativeElement.querySelectorAll('.test-item-name');
      expect(itemElements.length).toBe(2);
    }));
  });
});
