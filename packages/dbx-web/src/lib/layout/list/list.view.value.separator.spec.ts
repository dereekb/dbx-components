import { describe, expect, it } from 'vitest';
import { Component, InjectionToken, type StaticProvider, type ValueProvider } from '@angular/core';
import { type DbxValueListItem } from './list.view.value';
import { DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR, type DbxValueListItemSeparatorContext, type DbxValueListViewSeparatorConfig, dbxValueListItemSeparatorConfigs, dbxValueListItemSeparatorDecisionFunction } from './list.view.value.separator';

interface TestValue {
  readonly key: string;
}

@Component({
  selector: 'dbx-test-separator',
  template: ''
})
class TestSeparatorComponent {}

const EXTRA_TOKEN = new InjectionToken<string>('ExtraToken');

function makeItems(...keys: string[]): DbxValueListItem<TestValue>[] {
  return keys.map((key) => ({ key, itemValue: { key } }));
}

function separatorContext(providers: StaticProvider[] | null | undefined): DbxValueListItemSeparatorContext<TestValue> {
  const provider = (providers ?? []).find((x) => (x as ValueProvider).provide === DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR) as ValueProvider;
  return provider.useValue as DbxValueListItemSeparatorContext<TestValue>;
}

describe('dbxValueListItemSeparatorConfigs()', () => {
  it('should return no separators when the config is not provided', () => {
    const result = dbxValueListItemSeparatorConfigs(makeItems('a', 'b'), undefined);
    expect(result).toEqual([]);
  });

  it('should return one entry per position around the items', () => {
    const config: DbxValueListViewSeparatorConfig<TestValue> = {
      componentClass: TestSeparatorComponent,
      showSeparator: () => false
    };

    const result = dbxValueListItemSeparatorConfigs(makeItems('a', 'b', 'c'), config);
    expect(result.length).toBe(4);
    expect(result.every((x) => x == null)).toBe(true);
  });

  it('should call showSeparator with undefined for the missing side at the edges', () => {
    const calls: string[] = [];
    const config: DbxValueListViewSeparatorConfig<TestValue> = {
      componentClass: TestSeparatorComponent,
      showSeparator: (previous, next) => {
        calls.push(`${previous?.itemValue.key ?? '^'}|${next?.itemValue.key ?? '$'}`);
        return false;
      }
    };

    dbxValueListItemSeparatorConfigs(makeItems('a', 'b'), config);
    expect(calls).toEqual(['^|a', 'a|b', 'b|$']);
  });

  it('should only create separators where showSeparator returns true', () => {
    const config: DbxValueListViewSeparatorConfig<TestValue> = {
      componentClass: TestSeparatorComponent,
      showSeparator: (previous, next) => previous?.itemValue.key === 'a' && next?.itemValue.key === 'b'
    };

    const result = dbxValueListItemSeparatorConfigs(makeItems('a', 'b', 'c'), config);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeUndefined();
    expect(result[3]).toBeUndefined();
  });

  it('should provide the neighbouring items to the separator and keep the config providers', () => {
    const items = makeItems('a', 'b');
    const config: DbxValueListViewSeparatorConfig<TestValue> = {
      componentClass: TestSeparatorComponent,
      providers: [{ provide: EXTRA_TOKEN, useValue: 'extra' }],
      showSeparator: (previous, next) => previous != null && next != null
    };

    const separator = dbxValueListItemSeparatorConfigs(items, config)[1];

    expect(separator?.componentClass).toBe(TestSeparatorComponent);
    expect((separator as unknown as Partial<DbxValueListViewSeparatorConfig<TestValue>>).showSeparator).toBeUndefined();

    const context = separatorContext(separator?.providers);
    expect(context.previous).toBe(items[0]);
    expect(context.next).toBe(items[1]);
    expect((separator?.providers ?? []).some((x) => (x as ValueProvider).provide === EXTRA_TOKEN)).toBe(true);
  });
  it('should give each computed separator a new init that still calls the config init', () => {
    const initialized: unknown[] = [];
    const config: DbxValueListViewSeparatorConfig<TestValue> = {
      componentClass: TestSeparatorComponent,
      init: (instance) => initialized.push(instance),
      showSeparator: (previous, next) => previous != null && next != null
    };

    const items = makeItems('a', 'b');
    const first = dbxValueListItemSeparatorConfigs(items, config)[1];
    const second = dbxValueListItemSeparatorConfigs(items, config)[1];

    // a new init per computation makes dbx-injection re-create the separator with its current neighbours
    expect(first?.init).toBeDefined();
    expect(first?.init).not.toBe(second?.init);

    const instance = new TestSeparatorComponent();
    first?.init?.(instance);
    expect(initialized).toEqual([instance]);
  });
});

describe('dbxValueListItemSeparatorDecisionFunction()', () => {
  it('should pass the item values, or undefined for a missing side, to the decision function', () => {
    const calls: [TestValue | undefined | null, TestValue | undefined | null][] = [];
    const showSeparator = dbxValueListItemSeparatorDecisionFunction<TestValue>((previous, next) => {
      calls.push([previous, next]);
      return true;
    });

    const [a, b] = makeItems('a', 'b');

    expect(showSeparator(a, b)).toBe(true);
    expect(showSeparator(undefined, a)).toBe(true);
    expect(calls).toEqual([
      [a.itemValue, b.itemValue],
      [undefined, a.itemValue]
    ]);
  });
});
