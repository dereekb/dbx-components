/**
 * Exhaustive type and runtime tests for the searchable chip forge field.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { firstValueFrom, first, of, timeout } from 'rxjs';
import type { DbxForgeSearchableChipFieldConfig } from './searchable-chip.field';
import { forgeSearchableChipField, forgeSearchableStringChipField } from './searchable-chip.field';
import type { DbxForgeSearchableChipFieldDef, DbxForgeSearchableChipFieldProps } from './searchable.field';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, inject, provideZonelessChangeDetection } from '@angular/core';
import { provideDbxForgeFormFieldDeclarations } from '../../../../forge/forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../../forge/form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../../forge/form/forge.context';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

/**
 * Extracts the inner field from a wrapper field using the utility function.
 * Returns `any` for convenient runtime property access in tests.
 */
function getInnerField(field: any): any {
  return field;
}

// ============================================================================
// DbxForgeSearchableChipFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableChipFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeSearchableChipFieldDef>
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
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeSearchableChipFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgeSearchableChipFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | string[] | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeSearchableChipFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableChipFieldDef - Exhaustive Whitelist', () => {
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
    // From BaseValueField
    | 'value'
    | 'placeholder';

  type ActualKeys = keyof DbxForgeSearchableChipFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-searchable-chip', () => {
    expectTypeOf<DbxForgeSearchableChipFieldDef['type']>().toEqualTypeOf<'dbx-searchable-chip'>();
  });

  it('props is DbxForgeSearchableChipFieldProps', () => {
    expectTypeOf<DbxForgeSearchableChipFieldDef['props']>().toEqualTypeOf<DbxForgeSearchableChipFieldProps | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgeSearchableChipFieldDef - Usage', () => {
  it('should accept valid searchable chip field configuration', () => {
    const field = {
      type: 'dbx-searchable-chip',
      key: 'tags',
      label: 'Tags'
    } as const satisfies DbxForgeSearchableChipFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-searchable-chip'>();
  });
});

// ============================================================================
// Runtime Factory Tests - forgeSearchableChipField()
// ============================================================================

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

  // MARK: Wrapper structure
  it('should return a wrapper with type "wrapper"', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-searchable-chip');
  });

  it('should use key_wrapper naming for the wrapper key', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.key).toBe('tags');
  });

  // MARK: Inner field structure
  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), label: 'Tags' }) as any);
    expect(inner.label).toBe('Tags');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), hint: 'Add tags' } as any) as any);
    expect(inner.props?.hint).toBe('Add tags');
  });

  it('should not set hint on inner field when hint is not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.hint).toBeUndefined();
  });

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.key).toBe('tags');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), required: true }) as any);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), readonly: true }) as any);
    expect(inner.readonly).toBe(true);
  });

  // MARK: Props passthrough
  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ allowStringValues: true })) as any);
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ searchOnEmptyText: true })) as any);
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ multiSelect: false })) as any);
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ asArrayValue: false })) as any);
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate textInputValidator through inner field props when provided', () => {
    const validator = () => null;
    const inner = getInnerField(forgeSearchableChipField(withProps({ textInputValidator: validator })) as any);
    expect(inner.props?.textInputValidator).toBe(validator);
  });

  it('should not set textInputValidator on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.textInputValidator).toBeUndefined();
  });

  it('should propagate useAnchor through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField(withProps({ useAnchor: true })) as any);
    expect(inner.props?.useAnchor).toBe(true);
  });

  it('should propagate anchorForValue through inner field props when provided', () => {
    const anchorFn = () => ({ onClick: () => {} });
    const inner = getInnerField(forgeSearchableChipField(withProps({ anchorForValue: anchorFn })) as any);
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), logic }) as any);
    expect((inner as any).logic).toEqual(logic);
  });
});

// ============================================================================
// Runtime Factory Tests - forgeSearchableStringChipField()
// ============================================================================

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

  it('should return a field with type "dbx-searchable-chip"', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-searchable-chip');
  });

  it('should use the key directly', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.key).toBe('keywords');
  });

  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), label: 'Keywords' }) as any);
    expect(inner.label).toBe('Keywords');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), hint: 'Enter keywords' } as any) as any);
    expect(inner.props?.hint).toBe('Enter keywords');
  });

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.key).toBe('keywords');
  });

  it('should not set allowStringValues by default (caller provides it when needed)', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), required: true }) as any);
    expect(inner.required).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), props: { ...minimalConfig().props, searchOnEmptyText: true } } as any) as any);
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });
});

// ============================================================================
// Component-level tests - DbxForgeSearchableChipFieldComponent
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
class SearchableChipTestHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

const SEARCHABLE_CHIP_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('DbxForgeSearchableChipFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableChipTestHostComponent],
      providers: SEARCHABLE_CHIP_TEST_PROVIDERS
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
    const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createSingleSelectChipConfig();

    await settle(fixture);

    context.setValue({ pickOne: 'a' } as any);
    await settle(fixture);

    const afterFirstSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterFirstSelect as any)?.pickOne).toBe('a');

    context.setValue({ pickOne: 'b' } as any);
    await settle(fixture);

    const afterSecondSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect((afterSecondSelect as any)?.pickOne).toBe('b');

    fixture.destroy();
  });
});
