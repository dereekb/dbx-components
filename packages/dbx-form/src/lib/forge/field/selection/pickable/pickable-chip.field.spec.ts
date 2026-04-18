/**
 * Exhaustive type and runtime tests for the pickable chip forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import type { DbxForgePickableChipFieldConfig } from './pickable-chip.field';
import { forgePickableChipField } from './pickable-chip.field';
import type { DbxForgePickableChipFieldDef, DbxForgePickableFieldProps } from './pickable.field';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';

// MARK: Shared Stubs
const stubLoadValues = () => of([{ value: 'a' }, { value: 'b' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));
const stubFilterValues = (_text: string | undefined | null, values: { value: string }[]) => of(values.map((v) => v.value));

// ============================================================================
// DbxForgePickableChipFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableChipFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgePickableChipFieldDef>
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

  type ActualKeys = keyof DbxForgePickableChipFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });

    it('schemas', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['schemas']>().toEqualTypeOf<SchemaApplicationConfig[] | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgePickableChipFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | string[] | undefined>();
    });

    it('hint is accessible with concrete generics', () => {
      // hint/description are conditional on the props type having a hint property.
      // With default generics the conditional defers to never; with concrete types it resolves.
      const config: DbxForgePickableChipFieldConfig<string> = { key: 'test', hint: 'test hint' } as any;
      expect(config.hint).toBe('test hint');
    });
  });
});

// ============================================================================
// DbxForgePickableChipFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableChipFieldDef - Exhaustive Whitelist', () => {
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

  type ActualKeys = keyof DbxForgePickableChipFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-pickable-chip', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['type']>().toEqualTypeOf<'dbx-pickable-chip'>();
  });

  it('value is T | T[] (default: unknown | unknown[])', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['value']>().toEqualTypeOf<unknown | unknown[] | undefined>();
  });

  it('props is DbxForgePickableFieldProps', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['props']>().toEqualTypeOf<DbxForgePickableFieldProps | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgePickableChipFieldDef - Usage', () => {
  it('should accept valid pickable chip field configuration', () => {
    const field = {
      type: 'dbx-pickable-chip',
      key: 'tags',
      label: 'Tags'
    } as const satisfies DbxForgePickableChipFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-pickable-chip'>();
  });
});

// ============================================================================
// Runtime Factory Tests - forgePickableChipField()
// ============================================================================

describe('forgePickableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      props: {
        loadValues: stubLoadValues,
        displayForValue: stubDisplayForValue
      }
    } as DbxForgePickableChipFieldConfig<string>;
  }

  // MARK: Field structure
  it('should create a field with dbx-pickable-chip type', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.type).toBe('dbx-pickable-chip');
  });

  it('should use the data key directly', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.key).toBe('tags');
  });

  it('should have wrappers defined on the field', () => {
    const field = forgePickableChipField(minimalConfig());
    expect((field as any).wrappers).toBeDefined();
  });

  // MARK: Inner field structure
  it('should create an inner field with dbx-pickable-chip type', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.type).toBe('dbx-pickable-chip');
  });

  it('should set the data key on the inner field', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.key).toBe('tags');
  });

  it('should set label on the inner field', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(inner.label).toBe('Tags');
  });

  // MARK: Required/readonly passthrough
  it('should set required on the inner field when provided', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), required: true });
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), readonly: true });
    expect(inner.readonly).toBe(true);
  });

  // MARK: Hint/description mapping
  it('should map description to inner field props.hint', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), description: 'Pick your tags' });
    expect(inner.props?.hint).toBe('Pick your tags');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), hint: 'Pick your tags' });
    expect(inner.props?.hint).toBe('Pick your tags');
  });

  it('should not set hint on inner field when neither hint nor description is provided', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate loadValues through inner field props', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, multiSelect: false } });
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, asArrayValue: false } });
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const config = { ...minimalConfig(), props: { ...minimalConfig().props!, filterValues: stubFilterValues } } as DbxForgePickableChipFieldConfig<string>;
    const inner = forgePickableChipField(config);
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const inner = forgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, filterLabel: 'Search tags' } });
    expect(inner.props?.filterLabel).toBe('Search tags');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const inner = forgePickableChipField(minimalConfig());
    expect(inner.props?.filterLabel).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = forgePickableChipField({ ...minimalConfig(), logic });
    expect(inner.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the inner field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue != null', kind: 'mustSelectTag' }];
    const inner = forgePickableChipField({ ...minimalConfig(), validators });
    expect(inner.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the inner field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectTag: 'Please select at least one tag' };
    const inner = forgePickableChipField({ ...minimalConfig(), validationMessages });
    expect(inner.validationMessages).toEqual(validationMessages);
  });
});

// ============================================================================
// Runtime Form Scenarios - forgePickableChipField()
// ============================================================================

describe('scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS, withLoggerConfig({ derivations: 'verbose' })]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('config resolution', () => {
    it('should resolve the wrapper field config containing the inner pickable chip field', async () => {
      const field = forgePickableChipField({
        key: 'tags',
        label: 'Tags',
        props: {
          loadValues: stubLoadValues,
          displayForValue: stubDisplayForValue
        }
      } as DbxForgePickableChipFieldConfig<string>);

      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe('dbx-pickable-chip');
    });
  });
});
