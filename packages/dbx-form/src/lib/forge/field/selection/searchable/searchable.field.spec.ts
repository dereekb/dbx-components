import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, first, map, of, Subject, take, timeout } from 'rxjs';
import { FormControl } from '@angular/forms';
import { forgeSearchableTextField, forgeSearchableChipField, forgeSearchableStringChipField } from './searchable.field';
import type { DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

// MARK: Helpers
/**
 * Extracts the inner field from a DbxForgeFormFieldWrapperFieldDef.
 * The wrapper nests the actual field inside `props.field`.
 * Returns `any` for convenient runtime property access in tests.
 */
function getInnerField(wrapper: DbxForgeFormFieldWrapperFieldDef): any {
  const field = (wrapper.props as any)?.field;
  expect(field).toBeDefined();
  return field;
}

// MARK: forgeSearchableTextField
describe('forgeSearchableTextField()', () => {
  function minimalConfig() {
    return {
      key: 'assignee',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof forgeSearchableTextField>[0];
  }

  function withProps(extra: Record<string, unknown>) {
    return { ...minimalConfig(), props: { ...minimalConfig().props, ...extra } } as any;
  }

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableTextField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableTextField({ ...minimalConfig(), label: 'Assignee' });
    expect(wrapper.label).toBe('Assignee');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableTextField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map hint to inner field props.hint', () => {
    const wrapper = forgeSearchableTextField({ ...minimalConfig(), hint: 'Search for a person' } as any);
    const inner = getInnerField(wrapper);
    expect(inner.props?.hint).toBe('Search for a person');
  });

  it('should not set hint on inner field when hint is not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.hint).toBeUndefined();
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-text');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.key).toBe('assignee');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), readonly: true }));
    expect(inner.readonly).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField(withProps({ allowStringValues: true })));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField(withProps({ searchOnEmptyText: true })));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate showClearValue through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField(withProps({ showClearValue: false })));
    expect(inner.props?.showClearValue).toBe(false);
  });

  it('should propagate searchLabel through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField(withProps({ searchLabel: 'Find...' })));
    expect(inner.props?.searchLabel).toBe('Find...');
  });

  it('should propagate useAnchor through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField(withProps({ useAnchor: true })));
    expect(inner.props?.useAnchor).toBe(true);
  });

  it('should not set useAnchor on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.useAnchor).toBeUndefined();
  });

  it('should propagate anchorForValue through inner field props when provided', () => {
    const anchorFn = () => ({ onClick: () => {} });
    const inner = getInnerField(forgeSearchableTextField(withProps({ anchorForValue: anchorFn })));
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  it('should not set anchorForValue on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.anchorForValue).toBeUndefined();
  });

  it('should propagate both useAnchor and anchorForValue together', () => {
    const anchorFn = () => ({ onClick: () => {} });
    const inner = getInnerField(forgeSearchableTextField(withProps({ useAnchor: true, anchorForValue: anchorFn })));
    expect(inner.props?.useAnchor).toBe(true);
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  it('should pass logic through to the wrapper field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const wrapper = forgeSearchableTextField({ ...minimalConfig(), logic });
    expect((wrapper as any).logic).toEqual(logic);
  });
});

// MARK: forgeSearchableChipField
describe('forgeSearchableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof forgeSearchableChipField>[0];
  }

  function withProps(extra: Record<string, unknown>) {
    return { ...minimalConfig(), props: { ...minimalConfig().props, ...extra } } as any;
  }

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(wrapper.label).toBe('Tags');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map hint to inner field props.hint', () => {
    const wrapper = forgeSearchableChipField({ ...minimalConfig(), hint: 'Add tags' } as any);
    const inner = getInnerField(wrapper);
    expect(inner.props?.hint).toBe('Add tags');
  });

  it('should not set hint on inner field when hint is not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.hint).toBeUndefined();
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.key).toBe('tags');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), readonly: true }));
    expect(inner.readonly).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ allowStringValues: true })));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ searchOnEmptyText: true })));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ multiSelect: false })));
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ asArrayValue: false })));
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate textInputValidator through inner field props when provided', () => {
    const validator = () => null;
    const inner = getInnerField(forgeSearchableChipField(withProps({ textInputValidator: validator })));
    expect(inner.props?.textInputValidator).toBe(validator);
  });

  it('should not set textInputValidator on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.textInputValidator).toBeUndefined();
  });

  it('should propagate useAnchor through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ useAnchor: true })));
    expect(inner.props?.useAnchor).toBe(true);
  });

  it('should propagate anchorForValue through inner field props when provided', () => {
    const anchorFn = () => ({ onClick: () => {} });
    const inner = getInnerField(forgeSearchableChipField(withProps({ anchorForValue: anchorFn })));
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  it('should pass logic through to the wrapper field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const wrapper = forgeSearchableChipField({ ...minimalConfig(), logic });
    expect((wrapper as any).logic).toEqual(logic);
  });
});

// MARK: inputValue$ coercion
describe('inputValue$ non-string coercion', () => {
  it('should coerce a non-string FormControl value to an empty string', async () => {
    // Regression: mat-autocomplete sets the FormControl value to the selected
    // option object (not a string). The inputValue$ pipeline must coerce
    // non-string values to '' so the search function always receives a string.
    const inputCtrl = new FormControl<string>('');

    const inputValue$ = inputCtrl.valueChanges.pipe(map((x: unknown) => (typeof x === 'string' ? x : '')));

    // Push a non-string value (simulates mat-autocomplete selection)
    const valuePromise = firstValueFrom(inputValue$.pipe(take(1)));
    inputCtrl.setValue({ value: 'America/Chicago', label: 'America/Chicago' } as any);
    const result = await valuePromise;

    expect(result).toBe('');
  });

  it('should pass through a normal string value', async () => {
    const inputCtrl = new FormControl<string>('');

    const inputValue$ = inputCtrl.valueChanges.pipe(map((x: unknown) => (typeof x === 'string' ? x : '')));

    const valuePromise = firstValueFrom(inputValue$.pipe(take(1)));
    inputCtrl.setValue('America');
    const result = await valuePromise;

    expect(result).toBe('America');
  });
});

// MARK: forgeSearchableStringChipField
describe('forgeSearchableStringChipField()', () => {
  function minimalConfig() {
    return {
      key: 'keywords',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof forgeSearchableStringChipField>[0];
  }

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableStringChipField({ ...minimalConfig(), label: 'Keywords' });
    expect(wrapper.label).toBe('Keywords');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map hint to inner field props.hint', () => {
    const wrapper = forgeSearchableStringChipField({ ...minimalConfig(), hint: 'Enter keywords' } as any);
    const inner = getInnerField(wrapper);
    expect(inner.props?.hint).toBe('Enter keywords');
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.key).toBe('keywords');
  });

  it('should always set allowStringValues to true on the inner field', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), props: { ...minimalConfig().props, searchOnEmptyText: true } } as any));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });
});

// MARK: Component-level tests
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, inject, provideZonelessChangeDetection } from '@angular/core';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { provideDbxForgeFormFieldDeclarations } from '../../../../forge/forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../../forge/form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../../forge/form/forge.context';

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class SearchableTestHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

const SEARCHABLE_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('DbxForgeSearchableChipFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableTestHostComponent],
      providers: SEARCHABLE_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createSingleSelectChipConfig(): FormConfig {
    return {
      fields: [
        forgeSearchableChipField<string>({
          key: 'pickOne',
          label: 'Pick a Single Value',
          props: {
            allowStringValues: false,
            searchOnEmptyText: true,
            multiSelect: false,
            asArrayValue: false,
            search: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
            displayForValue: (values: any[]) => of(values.map((v: any) => ({ ...v, label: String(v.value) })))
          }
        }) as any
      ]
    };
  }

  it('should replace the existing value when selecting a new value in single-select mode', async () => {
    const fixture = TestBed.createComponent(SearchableTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createSingleSelectChipConfig();

    await settle(fixture);

    // Set initial value (simulates selecting "a")
    context.setValue({ pickOne: 'a' } as any);
    await settle(fixture);

    const afterFirstSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterFirstSelect as any)?.pickOne).toBe('a');

    // Set a different value (simulates selecting "b")
    context.setValue({ pickOne: 'b' } as any);
    await settle(fixture);

    // The value should be replaced, not appended
    const afterSecondSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterSecondSelect as any)?.pickOne).toBe('b');

    fixture.destroy();
  });
});

describe('DbxForgeSearchableTextFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableTestHostComponent],
      providers: SEARCHABLE_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Mirrors the anchor3 "Anchor Segue For Metadata Items" demo config:
   * - no useAnchor (only anchorForValue)
   * - search returns items with meta
   * - has refreshDisplayValues$
   */
  function createMetadataAnchorSearchableConfig(): FormConfig {
    const refreshDisplayValues$ = new Subject<void>();

    return {
      fields: [
        forgeSearchableTextField({
          key: 'pick',
          label: 'Anchor Segue For Metadata Items',
          props: {
            allowStringValues: false,
            searchOnEmptyText: true,
            showSelectedValue: false,
            search: () =>
              of([
                { meta: { name: 'Test A', key: '1' }, value: '1' },
                { meta: { name: 'Test B', key: '2' }, value: '2' }
              ]),
            displayForValue: (values: any[]) => of(values.map((v: any) => ({ ...v, label: v.meta?.name ?? v.value, sublabel: 'item' }))),
            anchorForValue: (_fieldValue: any) => ({
              onClick: () => {
                // intentional no-op for test
              }
            }),
            refreshDisplayValues$
          }
        } as any) as any
      ]
    };
  }

  it('should not throw when selecting a value then clearing it', async () => {
    const fixture = TestBed.createComponent(SearchableTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createMetadataAnchorSearchableConfig();

    await settle(fixture);

    // Set a value (simulates selecting "Test A" from autocomplete)
    context.setValue({ pick: '1' } as any);
    await settle(fixture);

    // Assert the selected value came through
    const afterSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterSelect as any)?.pick).toBe('1');

    // Clear the value (simulates selecting "Clear" from autocomplete)
    context.setValue({ pick: null } as any);
    await settle(fixture);

    // Assert the value was cleared and no "fieldTree is not a function" error was thrown
    const afterClear = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterClear as any)?.pick).toBeFalsy();

    fixture.destroy();
  });
});
