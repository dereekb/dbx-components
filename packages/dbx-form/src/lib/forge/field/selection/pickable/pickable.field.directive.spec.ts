/**
 * Selection behavior shared by the pickable chip and list forge fields, run against both real components.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { waitForMs } from '@dereekb/util';
import { type PickableItemFieldItem } from '../../../../field/selection/pickable/pickable.item';
import { filterPickableItemFieldValuesByLabel } from '../../../../field/selection/pickable/pickable.util';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { dbxForgePickableChipField } from './pickable-chip.field';
import { DbxForgePickableChipFieldComponent } from './pickable-chip.field.component';
import { dbxForgePickableListField } from './pickable-list.field';
import { DbxForgePickableListFieldComponent } from './pickable-list.field.component';
import { type DbxForgePickableFieldProps } from './pickable.field';

type TestProps = Partial<DbxForgePickableFieldProps<any, any, any>>;

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

const TEST_PROPS = {
  loadValues: () => of(['a', 'b', 'c', 'd'].map((value) => ({ value }))),
  displayForValue: (values: { value: string }[]) => of(values.map((x) => ({ ...x, label: x.value })))
};

/**
 * Material reads the deprecated `keyCode`, which KeyboardEventInit does not declare, so the key events set it.
 */
const ENTER_KEY = { key: 'Enter', keyCode: 13 };
const SPACE_KEY = { key: ' ', keyCode: 32 };
const CTRL_A_KEY = { key: 'a', keyCode: 65, ctrlKey: true };

/**
 * The fields list their items after the text filter's 200ms debounce.
 */
const FILTER_SETTLE_MS = 300;

const CHIP_FIELD = {
  name: 'chip',
  component: DbxForgePickableChipFieldComponent,
  makeField: dbxForgePickableChipField,
  itemSelector: 'mat-chip-option',
  isSelected: (x: HTMLElement) => x.classList.contains('mat-mdc-chip-selected'),
  isDisabled: (x: HTMLElement) => x.classList.contains('mat-mdc-chip-disabled'),
  // a chip is toggled by its inner button
  control: (x: HTMLElement) => x.querySelector('button') as HTMLElement
};

const LIST_FIELD = {
  name: 'list',
  component: DbxForgePickableListFieldComponent,
  makeField: dbxForgePickableListField,
  itemSelector: 'mat-list-option',
  isSelected: (x: HTMLElement) => x.getAttribute('aria-selected') === 'true',
  isDisabled: (x: HTMLElement) => x.getAttribute('aria-disabled') === 'true',
  control: (x: HTMLElement) => x
};

type TestField = typeof CHIP_FIELD | typeof LIST_FIELD;

async function createTestField(testField: TestField, props: TestProps, initialValue: unknown = []) {
  const value = signal<any>(initialValue);
  const fixture: ComponentFixture<any> = TestBed.createComponent<any>(testField.component);
  const element = fixture.nativeElement as HTMLElement;

  async function settle(ms = 5) {
    fixture.detectChanges();
    await waitForMs(ms);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const setProps = (x: TestProps) => fixture.componentRef.setInput('props', { ...TEST_PROPS, ...x });
  const items = () => Array.from(element.querySelectorAll<HTMLElement>(testField.itemSelector));
  const label = (x: HTMLElement) => x.textContent?.trim();
  const control = (itemLabel: string) => testField.control(items().find((x) => label(x) === itemLabel) as HTMLElement);

  fixture.componentRef.setInput(
    'field',
    TestBed.runInInjectionContext(() => form(value))
  );
  fixture.componentRef.setInput('key', 'test');
  setProps(props);
  await settle(FILTER_SETTLE_MS);

  return {
    value,
    element,
    control,
    settle,
    setProps,
    labels: () => items().map(label),
    selected: () => items().filter(testField.isSelected).map(label),
    disabled: () => items().filter(testField.isDisabled).map(label),
    async click(...itemLabels: string[]) {
      for (const x of itemLabels) {
        control(x).click();
        await settle();
      }
    },
    async press(itemLabel: string, init: KeyboardEventInit & { readonly keyCode: number }) {
      control(itemLabel).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
      await settle();
    },
    async filter(text: string) {
      fixture.componentInstance.inputCtrl.setValue(text);
      await settle(FILTER_SETTLE_MS);
    },
    async clickSelectAll() {
      const button = testField.name === 'chip' ? control('All') : (element.querySelector('.dbx-pickable-select-all-button') as HTMLElement);
      button.click();
      await settle();
    },
    hasSelectAll: () => (testField.name === 'chip' ? items().some((x) => label(x) === 'All') : element.querySelector('.dbx-pickable-select-all-button') != null)
  };
}

const refuseThirdPick: TestProps['filterSelectedValues'] = ({ beforeValues, afterValues }) => (afterValues.length > 2 && afterValues.length > beforeValues.length ? beforeValues : afterValues);
const disableD: TestProps['sortItems'] = (items: PickableItemFieldItem<any, any>[]) => items.map((x) => (x.itemValue.value === 'd' ? { ...x, disabled: true } : x));

beforeEach(() => {
  TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe.each([CHIP_FIELD, LIST_FIELD])('pickable $name field', (testField) => {
  describe('maxPicks', () => {
    it('should disable the unselected items at the limit, and enable them again when a pick is taken back', async () => {
      const t = await createTestField(testField, { maxPicks: 2 });
      expect(t.disabled()).toEqual([]);

      await t.click('a', 'b');
      expect(t.value()).toEqual(['a', 'b']);
      expect(t.disabled()).toEqual(['c', 'd']);

      await t.click('c');
      expect(t.value()).toEqual(['a', 'b']);
      expect(t.selected()).toEqual(['a', 'b']);

      await t.click('a');
      expect(t.value()).toEqual(['b']);
      expect(t.disabled()).toEqual([]);

      await t.click('c');
      expect(t.value()).toEqual(['b', 'c']);
      expect(t.selected()).toEqual(['b', 'c']);
    });

    it('should let a selection seeded over the limit be reduced', async () => {
      const t = await createTestField(testField, { maxPicks: 2 }, ['a', 'b', 'c']);
      expect(t.value()).toEqual(['a', 'b', 'c']);
      expect(t.disabled()).toEqual(['d']);

      await t.click('c');
      expect(t.value()).toEqual(['a', 'b']);
      expect(t.disabled()).toEqual(['c', 'd']);

      await t.click('b');
      expect(t.value()).toEqual(['a']);
      expect(t.disabled()).toEqual([]);
    });

    it('should hold when several picks arrive before change detection', async () => {
      const t = await createTestField(testField, { maxPicks: 2 });

      ['a', 'b', 'c', 'd'].forEach((x) => t.control(x).click());
      await t.settle();

      expect(t.value()).toEqual(['a', 'b']);
      expect(t.selected()).toEqual(['a', 'b']);
      expect(t.disabled()).toEqual(['c', 'd']);
    });

    it('should count the picks hidden by the text filter', async () => {
      const t = await createTestField(testField, { maxPicks: 2, filterValues: filterPickableItemFieldValuesByLabel });
      await t.click('a', 'b');
      await t.filter('c');

      expect(t.labels()).toEqual(['c']);
      expect(t.disabled()).toEqual(['c']);
    });

    it('should only count a repeated value once', async () => {
      const t = await createTestField(testField, { maxPicks: 2 }, ['a', 'a']);
      expect(t.disabled()).toEqual([]);
    });

    it('should not apply when only one value can be picked', async () => {
      const t = await createTestField(testField, { maxPicks: 1, multiSelect: false });
      await t.click('a');
      expect(t.disabled()).toEqual([]);

      await t.click('b');
      expect(t.value()).toEqual(['b']);
      expect(t.selected()).toEqual(['b']);
    });

    it('should follow changes to the limit', async () => {
      const t = await createTestField(testField, { maxPicks: 2 }, ['a', 'b']);
      expect(t.disabled()).toEqual(['c', 'd']);

      t.setProps({ maxPicks: 3 });
      await t.settle(FILTER_SETTLE_MS);
      expect(t.disabled()).toEqual([]);

      t.setProps({ maxPicks: null });
      await t.settle(FILTER_SETTLE_MS);
      await t.click('c', 'd');
      expect(t.value()).toEqual(['a', 'b', 'c', 'd']);
      expect(t.disabled()).toEqual([]);
    });

    it('should compare values by their hash', async () => {
      const loadValues$ = new BehaviorSubject(['1', '2', '3'].map((id) => ({ value: { id } })));
      const t = await createTestField(testField, { maxPicks: 2, loadValues: () => loadValues$, hashForValue: (x) => x.id, displayForValue: (values) => of(values.map((x) => ({ ...x, label: x.value.id }))) });
      await t.click('1', '3');
      expect(t.value().map((x: { id: string }) => x.id)).toEqual(['1', '3']);
      expect(t.disabled()).toEqual(['2']);

      loadValues$.next(['1', '2', '3'].map((id) => ({ value: { id } })));
      await t.settle(FILTER_SETTLE_MS);
      expect(t.selected()).toEqual(['1', '3']);
      expect(t.disabled()).toEqual(['2']);
    });

    it('should only offer select-all when every loaded value can be picked', async () => {
      const t = await createTestField(testField, { maxPicks: 3, showSelectAllButton: true });
      expect(t.hasSelectAll()).toBe(false);

      t.setProps({ maxPicks: 4, showSelectAllButton: true });
      await t.settle(FILTER_SETTLE_MS);
      expect(t.hasSelectAll()).toBe(true);

      await t.clickSelectAll();
      expect(t.value()).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('refused picks', () => {
    it('should not show a pick that filterSelectedValues refused', async () => {
      const t = await createTestField(testField, { filterSelectedValues: refuseThirdPick });
      await t.click('a', 'b', 'c');
      expect(t.value()).toEqual(['a', 'b']);
      expect(t.selected()).toEqual(['a', 'b']);
    });

    it('should not add a refused pick with a later change', async () => {
      const t = await createTestField(testField, { filterSelectedValues: refuseThirdPick });
      await t.click('a', 'b', 'c', 'a');
      expect(t.value()).toEqual(['b']);
      expect(t.selected()).toEqual(['b']);
    });

    it('should show the value when it is set back before change detection', async () => {
      const t = await createTestField(testField, {}, ['b']);
      t.control('a').click();
      t.value.set(['b']);
      await t.settle();
      expect(t.selected()).toEqual(['b']);
    });

    it('should leave the form untouched', async () => {
      const fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
      const field = testField.makeField<any>({ key: 'test', props: { ...TEST_PROPS, filterSelectedValues: ({ beforeValues }) => beforeValues } });
      fixture.componentInstance.config.set({ fields: [field] });

      async function settle(ms: number) {
        fixture.detectChanges();
        await waitForMs(ms);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      }

      await settle(FILTER_SETTLE_MS);
      await settle(FILTER_SETTLE_MS);

      testField.control((fixture.nativeElement as HTMLElement).querySelector(testField.itemSelector) as HTMLElement).click();
      await settle(FILTER_SETTLE_MS);

      const event = await firstValueFrom(fixture.componentInstance.context.stream$);
      expect(event.pristine).toBe(true);
    });
  });

  describe('text filter', () => {
    it('should keep the picks the filter hides', async () => {
      const t = await createTestField(testField, { filterValues: filterPickableItemFieldValuesByLabel });
      await t.click('a', 'b');
      await t.filter('c');
      await t.click('c');
      expect(t.value()).toEqual(['a', 'b', 'c']);

      await t.filter('');
      expect(t.selected()).toEqual(['a', 'b', 'c']);
    });

    it('should show the value after the filter changes', async () => {
      const t = await createTestField(testField, { filterValues: filterPickableItemFieldValuesByLabel });
      await t.click('a');
      t.value.set(['b']);
      await t.settle();
      await t.filter('zzz');
      await t.filter('');
      expect(t.selected()).toEqual(['b']);
    });

    it('should keep a value that is not loaded', async () => {
      const t = await createTestField(testField, {}, ['zz']);
      await t.click('a');
      expect(t.value()).toEqual(['zz', 'a']);
    });
  });

  describe('select all', () => {
    it('should keep the picks the filter hides', async () => {
      const t = await createTestField(testField, { showSelectAllButton: true, filterValues: filterPickableItemFieldValuesByLabel });
      await t.click('a');
      await t.filter('c');
      await t.clickSelectAll();
      expect(t.value()).toEqual(['a', 'c']);

      await t.clickSelectAll();
      expect(t.value()).toEqual(['a']);
    });

    it('should deselect again when an item is disabled', async () => {
      const t = await createTestField(testField, { showSelectAllButton: true, sortItems: disableD });
      await t.clickSelectAll();
      expect(t.value()).toEqual(['a', 'b', 'c']);

      await t.clickSelectAll();
      expect(t.value()).toEqual([]);
      expect(t.selected()).toEqual([]);
    });
  });

  describe('asArrayValue = false', () => {
    it('should replace the pick', async () => {
      const t = await createTestField(testField, { asArrayValue: false }, null);
      await t.click('a');
      expect(t.value()).toBe('a');

      await t.click('b');
      expect(t.value()).toBe('b');
      expect(t.selected()).toEqual(['b']);
    });
  });
});

describe('pickable chip field', () => {
  it('should pick and un-pick with Enter and Space', async () => {
    const t = await createTestField(CHIP_FIELD, { maxPicks: 2 });
    await t.press('a', ENTER_KEY);
    expect(t.value()).toEqual(['a']);

    await t.press('b', SPACE_KEY);
    expect(t.value()).toEqual(['a', 'b']);
    expect(t.disabled()).toEqual(['c', 'd']);

    await t.press('c', ENTER_KEY);
    expect(t.value()).toEqual(['a', 'b']);

    await t.press('a', ENTER_KEY);
    expect(t.value()).toEqual(['b']);
    expect(t.selected()).toEqual(['b']);
  });

  it('should select all with Enter', async () => {
    const t = await createTestField(CHIP_FIELD, { showSelectAllButton: true });
    await t.press('All', ENTER_KEY);
    expect(t.value()).toEqual(['a', 'b', 'c', 'd']);
    expect(t.selected()).toEqual(['All', 'a', 'b', 'c', 'd']);
  });

  it('should clear a single value when it is clicked again', async () => {
    const t = await createTestField(CHIP_FIELD, { asArrayValue: false }, 'a');
    await t.click('a');
    expect(t.value()).toBeNull();
    expect(t.selected()).toEqual([]);
  });
});

describe('pickable list field', () => {
  it('should pick up to the limit with Ctrl+A, then deselect', async () => {
    const t = await createTestField(LIST_FIELD, { maxPicks: 2 }, ['c']);
    t.control('a').focus();

    await t.press('a', CTRL_A_KEY);
    expect(t.value()).toEqual(['c', 'a']);
    expect(t.selected()).toEqual(['a', 'c']);
    expect(t.disabled()).toEqual(['b', 'd']);

    await t.press('a', CTRL_A_KEY);
    expect(t.value()).toEqual([]);
    expect(t.selected()).toEqual([]);
  });
});
