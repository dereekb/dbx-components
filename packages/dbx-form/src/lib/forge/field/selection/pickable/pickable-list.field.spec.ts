/**
 * Exhaustive type and runtime tests for the pickable list forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import type { DbxForgePickableListFieldConfig } from './pickable-list.field';
import { forgePickableListField } from './pickable-list.field';
import type { DbxForgePickableListFieldDef, DbxForgePickableFieldProps } from './pickable.field';
import { DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { getDbxForgeFormFieldWrapperWrappedField } from '../../wrapper/formfield/formfield.wrapper.util';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';

// MARK: Shared Stubs
const stubLoadValues = () => of([{ value: 'a' }, { value: 'b' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));
const stubFilterValues = (_text: string | undefined | null, values: { value: string }[]) => of(values.map((v) => v.value));

// ============================================================================
// DbxForgePickableListFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableListFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgePickableListFieldDef>
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
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgePickableListFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });

    it('schemas', () => {
      expectTypeOf<DbxForgePickableListFieldConfig['schemas']>().toEqualTypeOf<SchemaApplicationConfig[] | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgePickableListFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | string[] | undefined>();
    });

    it('hint is accessible with concrete generics', () => {
      const config: DbxForgePickableListFieldConfig<string> = { key: 'test', hint: 'test hint' } as any;
      expect(config.hint).toBe('test hint');
    });
  });
});

// ============================================================================
// DbxForgePickableListFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableListFieldDef - Exhaustive Whitelist', () => {
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
    // From BaseValueField
    | 'value'
    | 'placeholder';

  type ActualKeys = keyof DbxForgePickableListFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-pickable-list', () => {
    expectTypeOf<DbxForgePickableListFieldDef['type']>().toEqualTypeOf<'dbx-pickable-list'>();
  });

  it('value is T | T[] (default: unknown | unknown[])', () => {
    expectTypeOf<DbxForgePickableListFieldDef['value']>().toEqualTypeOf<unknown | unknown[] | undefined>();
  });

  it('props is DbxForgePickableFieldProps', () => {
    expectTypeOf<DbxForgePickableListFieldDef['props']>().toEqualTypeOf<DbxForgePickableFieldProps | undefined>();
  });
});

// ============================================================================
// DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgePickableListFieldDef> - Structure
// ============================================================================

describe('DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgePickableListFieldDef>', () => {
  it('fields[0] is typed as DbxForgePickableListFieldDef', () => {
    type WrapperFieldDef = DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgePickableListFieldDef>;
    expectTypeOf<WrapperFieldDef['fields'][0]>().toEqualTypeOf<DbxForgePickableListFieldDef>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgePickableListFieldDef - Usage', () => {
  it('should accept valid pickable list field configuration', () => {
    const field = {
      type: 'dbx-pickable-list',
      key: 'categories',
      label: 'Categories'
    } as const satisfies DbxForgePickableListFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-pickable-list'>();
  });
});

// ============================================================================
// Runtime Factory Tests - forgePickableListField()
// ============================================================================

describe('forgePickableListField()', () => {
  function minimalConfig() {
    return {
      key: 'categories',
      props: {
        loadValues: stubLoadValues,
        displayForValue: stubDisplayForValue
      }
    } as DbxForgePickableListFieldConfig<string>;
  }

  // MARK: Wrapper structure
  it('should create a wrapper field', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.type).toBe('wrapper');
  });

  it('should use _wrapper naming for the wrapper key', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.key).toContain('_wrapper');
  });

  it('should contain an inner field in the wrapper', () => {
    const field = forgePickableListField(minimalConfig());
    expect(getDbxForgeFormFieldWrapperWrappedField(field)).toBeDefined();
  });

  // MARK: Inner field structure
  it('should create an inner field with dbx-pickable-list type', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.type).toBe('dbx-pickable-list');
  });

  it('should set the data key on the inner field', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.key).toBe('categories');
  });

  it('should set label on the inner field', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), label: 'Categories' }));
    expect(inner.label).toBe('Categories');
  });

  // MARK: Required/readonly passthrough
  it('should set required on the inner field when provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), readonly: true }));
    expect(inner.readonly).toBe(true);
  });

  // MARK: Hint/description mapping
  it('should map description to inner field props.hint', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), description: 'Choose categories' }));
    expect(inner.props?.hint).toBe('Choose categories');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), hint: 'Choose categories' }));
    expect(inner.props?.hint).toBe('Choose categories');
  });

  it('should not set hint on inner field when neither hint nor description is provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate loadValues through inner field props', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, multiSelect: false } }));
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, asArrayValue: false } }));
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const config = { ...minimalConfig(), props: { ...minimalConfig().props!, filterValues: stubFilterValues } } as DbxForgePickableListFieldConfig<string>;
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(config));
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, filterLabel: 'Filter items' } }));
    expect(inner.props?.filterLabel).toBe('Filter items');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField(minimalConfig()));
    expect(inner.props?.filterLabel).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), logic }));
    expect(inner.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the inner field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue != null', kind: 'mustSelectCategory' }];
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), validators }));
    expect(inner.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the inner field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectCategory: 'Please select at least one category' };
    const inner = getDbxForgeFormFieldWrapperWrappedField(forgePickableListField({ ...minimalConfig(), validationMessages }));
    expect(inner.validationMessages).toEqual(validationMessages);
  });
});

// ============================================================================
// Runtime Form Scenarios - forgePickableListField()
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
    it('should resolve the wrapper field config containing the inner pickable list field', async () => {
      const field = forgePickableListField({
        key: 'categories',
        label: 'Categories',
        props: {
          loadValues: stubLoadValues,
          displayForValue: stubDisplayForValue
        }
      } as DbxForgePickableListFieldConfig<string>);

      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe('wrapper');
    });
  });
});
