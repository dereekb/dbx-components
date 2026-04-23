/**
 * Exhaustive type and runtime tests for the searchable text forge field.
 */
import { describe, it, expect, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { firstValueFrom, first, map, of, Subject, take, timeout } from 'rxjs';
import { FormControl } from '@angular/forms';
import type { DbxForgeSearchableTextFieldConfig } from './searchable-text.field';
import { dbxForgeSearchableTextField } from './searchable-text.field';
import type { DbxForgeSearchableTextFieldDef, DbxForgeSearchableTextFieldProps } from './searchable.field';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, inject, provideZonelessChangeDetection } from '@angular/core';
import { provideDbxForgeFormFieldDeclarations } from '../../../../forge/forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../../forge/form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../../forge/form/forge.context';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

function getInnerField(field: any): any {
  return field;
}

// ============================================================================
// DbxForgeSearchableTextFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableTextFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeSearchableTextFieldDef>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'wrappers'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeSearchableTextFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeSearchableTextFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeSearchableTextFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeSearchableTextFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeSearchableTextFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeSearchableTextFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgeSearchableTextFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeSearchableTextFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableTextFieldDef - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From FieldDef
    | 'key'
    | 'type'
    | 'label'
    | 'props'
    | 'className'
    | 'disabled'
    | 'readonly'
    | 'hidden'
    | 'tabIndex'
    | 'col'
    | 'meta'
    // Value exclusion config
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // From FieldWithValidation
    | 'required'
    | 'email'
    | 'min'
    | 'max'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'validators'
    | 'validationMessages'
    | 'logic'
    | 'derivation'
    | 'schemas'
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    // From BaseValueField
    | 'value'
    | 'placeholder'
    | 'nullable';

  type ActualKeys = keyof DbxForgeSearchableTextFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-searchable-text', () => {
    expectTypeOf<DbxForgeSearchableTextFieldDef['type']>().toEqualTypeOf<'dbx-searchable-text'>();
  });

  it('props is DbxForgeSearchableTextFieldProps', () => {
    expectTypeOf<DbxForgeSearchableTextFieldDef['props']>().toEqualTypeOf<DbxForgeSearchableTextFieldProps | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgeSearchableTextFieldDef - Usage', () => {
  it('should accept valid searchable text field configuration', () => {
    const field = {
      type: 'dbx-searchable-text',
      key: 'assignee',
      label: 'Assignee'
    } as const satisfies DbxForgeSearchableTextFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-searchable-text'>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeSearchableTextField()
// ============================================================================

describe('dbxForgeSearchableTextField()', () => {
  function minimalConfig() {
    return {
      key: 'assignee',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof dbxForgeSearchableTextField>[0];
  }

  function withProps(extra: Record<string, unknown>) {
    return { ...minimalConfig(), props: { ...minimalConfig().props, ...extra } } as any;
  }

  // MARK: Wrapper structure
  it('should return a wrapper with type "wrapper"', () => {
    const wrapper = dbxForgeSearchableTextField(minimalConfig());
    expect(wrapper.type).toBe('dbx-searchable-text');
  });

  it('should use key_wrapper naming for the wrapper key', () => {
    const wrapper = dbxForgeSearchableTextField(minimalConfig());
    expect(wrapper.key).toBe('assignee');
  });

  // MARK: Inner field structure
  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField({ ...minimalConfig(), label: 'Assignee' }) as any);
    expect(inner.label).toBe('Assignee');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getInnerField(dbxForgeSearchableTextField({ ...minimalConfig(), hint: 'Search for a person' } as any) as any);
    expect(inner.props?.hint).toBe('Search for a person');
  });

  it('should not set hint on inner field when hint is not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.hint).toBeUndefined();
  });

  it('should set the correct inner field type', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.type).toBe('dbx-searchable-text');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.key).toBe('assignee');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField({ ...minimalConfig(), required: true }) as any);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField({ ...minimalConfig(), readonly: true }) as any);
    expect(inner.readonly).toBe(true);
  });

  // MARK: Props passthrough
  it('should propagate search through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ allowStringValues: true })) as any);
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ searchOnEmptyText: true })) as any);
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate showClearValue through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ showClearValue: false })) as any);
    expect(inner.props?.showClearValue).toBe(false);
  });

  it('should propagate searchLabel through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ searchLabel: 'Find...' })) as any);
    expect(inner.props?.searchLabel).toBe('Find...');
  });

  it('should propagate useAnchor through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ useAnchor: true })) as any);
    expect(inner.props?.useAnchor).toBe(true);
  });

  it('should not set useAnchor on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.useAnchor).toBeUndefined();
  });

  it('should propagate anchorForValue through inner field props when provided', () => {
    const anchorFn = () => ({
      onClick: () => {
        /* noop */
      }
    });
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ anchorForValue: anchorFn })) as any);
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  it('should not set anchorForValue on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableTextField(minimalConfig()) as any);
    expect(inner.props?.anchorForValue).toBeUndefined();
  });

  it('should propagate both useAnchor and anchorForValue together', () => {
    const anchorFn = () => ({
      onClick: () => {
        /* noop */
      }
    });
    const inner = getInnerField(dbxForgeSearchableTextField(withProps({ useAnchor: true, anchorForValue: anchorFn })) as any);
    expect(inner.props?.useAnchor).toBe(true);
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = getInnerField(dbxForgeSearchableTextField({ ...minimalConfig(), logic }) as any);
    expect((inner as any).logic).toEqual(logic);
  });
});

// ============================================================================
// inputValue$ non-string coercion
// ============================================================================

describe('inputValue$ non-string coercion', () => {
  it('should coerce a non-string FormControl value to an empty string', async () => {
    const inputCtrl = new FormControl<string>('');
    const inputValue$ = inputCtrl.valueChanges.pipe(map((x: unknown) => (typeof x === 'string' ? x : '')));

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

// ============================================================================
// Component-level tests - DbxForgeSearchableTextFieldComponent
// ============================================================================

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class SearchableTextTestHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

const SEARCHABLE_TEXT_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('DbxForgeSearchableTextFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableTextTestHostComponent],
      providers: SEARCHABLE_TEXT_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createMetadataAnchorSearchableConfig(): FormConfig {
    const refreshDisplayValues$ = new Subject<void>();

    return {
      fields: [
        dbxForgeSearchableTextField({
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
                /* noop */
              }
            }),
            refreshDisplayValues$
          }
        } as any) as any
      ]
    };
  }

  it('should not throw when selecting a value then clearing it', async () => {
    const fixture = TestBed.createComponent(SearchableTextTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createMetadataAnchorSearchableConfig();

    await settle(fixture);

    context.setValue({ pick: '1' } as any);
    await settle(fixture);

    const afterSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterSelect as any)?.pick).toBe('1');

    context.setValue({ pick: null } as any);
    await settle(fixture);

    const afterClear = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterClear as any)?.pick).toBeFalsy();

    fixture.destroy();
  });
});
