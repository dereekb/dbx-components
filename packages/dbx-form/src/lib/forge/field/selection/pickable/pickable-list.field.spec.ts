/**
 * Exhaustive type and runtime tests for the pickable list forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import type { DbxForgePickableListFieldConfig } from './pickable-list.field';
import { dbxForgePickableListField } from './pickable-list.field';
import type { DbxForgePickableListFieldDef, DbxForgePickableFieldProps } from './pickable.field';
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
    | 'wrappers'
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
    | 'wrappers'
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
// Runtime Factory Tests - dbxForgePickableListField()
// ============================================================================

describe('dbxForgePickableListField()', () => {
  function minimalConfig() {
    return {
      key: 'categories',
      props: {
        loadValues: stubLoadValues,
        displayForValue: stubDisplayForValue
      }
    } as DbxForgePickableListFieldConfig<string>;
  }

  // MARK: Field structure
  it('should create a field with dbx-pickable-list type', () => {
    const field = dbxForgePickableListField(minimalConfig());
    expect(field.type).toBe('dbx-pickable-list');
  });

  it('should use the data key directly', () => {
    const field = dbxForgePickableListField(minimalConfig());
    expect(field.key).toBe('categories');
  });

  it('should have wrappers defined on the field', () => {
    const field = dbxForgePickableListField(minimalConfig());
    expect((field as any).wrappers).toBeDefined();
  });

  // MARK: Inner field structure
  it('should create an inner field with dbx-pickable-list type', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.type).toBe('dbx-pickable-list');
  });

  it('should set the data key on the inner field', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.key).toBe('categories');
  });

  it('should set label on the inner field', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), label: 'Categories' });
    expect(inner.label).toBe('Categories');
  });

  // MARK: Required/readonly passthrough
  it('should set required on the inner field when provided', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), required: true });
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), readonly: true });
    expect(inner.readonly).toBe(true);
  });

  // MARK: Hint/description mapping
  it('should map description to inner field props.hint', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), description: 'Choose categories' });
    expect(inner.props?.hint).toBe('Choose categories');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), hint: 'Choose categories' });
    expect(inner.props?.hint).toBe('Choose categories');
  });

  it('should not set hint on inner field when neither hint nor description is provided', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate loadValues through inner field props', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, multiSelect: false } });
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, asArrayValue: false } });
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const config = { ...minimalConfig(), props: { ...minimalConfig().props!, filterValues: stubFilterValues } } as DbxForgePickableListFieldConfig<string>;
    const inner = dbxForgePickableListField(config);
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const inner = dbxForgePickableListField({ ...minimalConfig(), props: { ...minimalConfig().props!, filterLabel: 'Filter items' } });
    expect(inner.props?.filterLabel).toBe('Filter items');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const inner = dbxForgePickableListField(minimalConfig());
    expect(inner.props?.filterLabel).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = dbxForgePickableListField({ ...minimalConfig(), logic });
    expect(inner.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the inner field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue != null', kind: 'mustSelectCategory' }];
    const inner = dbxForgePickableListField({ ...minimalConfig(), validators });
    expect(inner.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the inner field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectCategory: 'Please select at least one category' };
    const inner = dbxForgePickableListField({ ...minimalConfig(), validationMessages });
    expect(inner.validationMessages).toEqual(validationMessages);
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgePickableListField()
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
      const field = dbxForgePickableListField({
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
      expect(formConfig.fields[0].type).toBe('dbx-pickable-list');
    });
  });
});
