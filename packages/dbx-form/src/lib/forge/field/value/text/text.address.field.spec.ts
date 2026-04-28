/**
 * Exhaustive type and runtime tests for the forge address fields.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { ArrayField, ContainerField, GroupField } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_FLEX_WRAPPER_TYPE_NAME } from '../../wrapper/flex/flex.wrapper';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeAddressGroup, dbxForgeAddressFields, dbxForgeAddressLineField, dbxForgeAddressListField } from './text.address.field';
import type { DbxForgeAddressGroupConfig, DbxForgeAddressFieldsConfig, DbxForgeAddressLineFieldConfig, DbxForgeAddressListFieldConfig } from './text.address.field';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME } from '../../wrapper/array-field/array-field.wrapper';
import { dbxForgeFinalizeFormConfig } from '../../../form/forge.form';

// Shared key set for DbxForgeTextFieldConfig (DbxForgeAddressLineFieldConfig extends Partial<DbxForgeTextFieldConfig>).
type DbxForgeTextFieldConfigKeys =
  // From DbxForgeFieldFunctionDef<DbxForgeStringInputFieldDef>
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
  | 'wrappers'
  | 'skipAutoWrappers'
  | 'skipDefaultWrappers'
  | 'nullable'
  | '__fieldDef'
  // Field-specific config
  | 'inputType'
  // From FieldAutocompleteAttributeOptionRef
  | 'autocomplete'
  // Direct declaration
  | 'idempotentTransform';

// ============================================================================
// DbxForgeAddressFieldsConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeAddressFieldsConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys = 'line1Field' | 'line2Field' | 'cityField' | 'stateField' | 'zipCodeField' | 'countryField' | 'required' | 'includeLine2' | 'includeCountry';

  type ActualKeys = keyof DbxForgeAddressFieldsConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('required is optional boolean', () => {
    expectTypeOf<DbxForgeAddressFieldsConfig['required']>().toEqualTypeOf<boolean | undefined>();
  });

  it('includeLine2 is optional boolean', () => {
    expectTypeOf<DbxForgeAddressFieldsConfig['includeLine2']>().toEqualTypeOf<boolean | undefined>();
  });

  it('includeCountry is optional boolean', () => {
    expectTypeOf<DbxForgeAddressFieldsConfig['includeCountry']>().toEqualTypeOf<boolean | undefined>();
  });
});

// ============================================================================
// DbxForgeAddressLineFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeAddressLineFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys = DbxForgeTextFieldConfigKeys | 'line';

  type ActualKeys = keyof DbxForgeAddressLineFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('field-specific config keys', () => {
    it('line is 0 | 1 | 2 or undefined', () => {
      expectTypeOf<DbxForgeAddressLineFieldConfig['line']>().toEqualTypeOf<0 | 1 | 2 | undefined>();
    });
  });

  describe('required keys are relaxed by Partial', () => {
    it('key is optional', () => {
      expectTypeOf<DbxForgeAddressLineFieldConfig['key']>().toEqualTypeOf<string | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeAddressGroupConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeAddressGroupConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeAddressFieldsConfig
    | 'line1Field'
    | 'line2Field'
    | 'cityField'
    | 'stateField'
    | 'zipCodeField'
    | 'countryField'
    | 'required'
    | 'includeLine2'
    | 'includeCountry'
    // Field-specific
    | 'key';

  type ActualKeys = keyof DbxForgeAddressGroupConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('key is optional string', () => {
    expectTypeOf<DbxForgeAddressGroupConfig['key']>().toEqualTypeOf<string | undefined>();
  });
});

// ============================================================================
// DbxForgeAddressListFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeAddressListFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeAddressFieldsConfig
    | 'line1Field'
    | 'line2Field'
    | 'cityField'
    | 'stateField'
    | 'zipCodeField'
    | 'countryField'
    | 'required'
    | 'includeLine2'
    | 'includeCountry'
    // Field-specific
    | 'key'
    | 'maxAddresses';

  type ActualKeys = keyof DbxForgeAddressListFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('key is optional string', () => {
    expectTypeOf<DbxForgeAddressListFieldConfig['key']>().toEqualTypeOf<string | undefined>();
  });

  it('maxAddresses is optional number', () => {
    expectTypeOf<DbxForgeAddressListFieldConfig['maxAddresses']>().toEqualTypeOf<number | undefined>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeAddressLineField()
// ============================================================================

describe('dbxForgeAddressLineField()', () => {
  it('should create a line 1 field by default', () => {
    const field = dbxForgeAddressLineField();
    expect(field.type).toBe('input');
    expect(field.key).toBe('line1');
    expect(field.label).toBe('Line 1');
  });

  it('should create a line 2 field', () => {
    const field = dbxForgeAddressLineField({ line: 2 });
    expect(field.key).toBe('line2');
    expect(field.label).toBe('Line 2');
  });

  it('should create a street field (label Street) for line 0 while clamping key to line1', () => {
    const field = dbxForgeAddressLineField({ line: 0 });
    expect(field.key).toBe('line1');
    expect(field.label).toBe('Street');
  });

  it('should allow overriding key and label', () => {
    const field = dbxForgeAddressLineField({ key: 'addr', label: 'Address', line: 1 });
    expect(field.key).toBe('addr');
    expect(field.label).toBe('Address');
  });

  it('should set required when specified', () => {
    const field = dbxForgeAddressLineField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should default required to false', () => {
    const field = dbxForgeAddressLineField();
    expect(field.required).toBe(false);
  });

  it('should default maxLength to ADDRESS_LINE_MAX_LENGTH', () => {
    const field = dbxForgeAddressLineField();
    expect(field.maxLength).toBeGreaterThan(0);
  });

  it('should allow overriding maxLength', () => {
    const field = dbxForgeAddressLineField({ maxLength: 10 });
    expect(field.maxLength).toBe(10);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeAddressFields()
// ============================================================================

describe('dbxForgeAddressFields()', () => {
  it('should create 3 fields with line2 and country by default', () => {
    const fields = dbxForgeAddressFields();
    // line1, line2, singleLineRow (city + state + zip + country)
    expect(fields.length).toBe(3);
  });

  it('should omit line2 when includeLine2 is false', () => {
    const fields = dbxForgeAddressFields({ includeLine2: false });
    // streetLine, singleLineRow
    expect(fields.length).toBe(2);
  });

  it('should still produce a singleLineRow when includeCountry is false', () => {
    const fields = dbxForgeAddressFields({ includeCountry: false });
    // line1, line2, singleLineRow (city + state + zip)
    expect(fields.length).toBe(3);
  });

  it('should drop country from the singleLineRow when includeCountry is false', () => {
    const fields = dbxForgeAddressFields({ includeCountry: false });
    const row = fields[2] as ContainerField;
    expect(row.fields).toHaveLength(3);
  });

  it('should reduce to streetLine + singleLineRow when both line2 and country are disabled', () => {
    const fields = dbxForgeAddressFields({ includeLine2: false, includeCountry: false });
    expect(fields.length).toBe(2);
  });

  it('should use Street label when includeLine2 is false', () => {
    const fields = dbxForgeAddressFields({ includeLine2: false });
    const streetField = fields[0] as MatInputField;
    expect(streetField.key).toBe('line1');
    expect(streetField.label).toBe('Street');
  });

  it('should use Line 1 label when includeLine2 is true', () => {
    const fields = dbxForgeAddressFields();
    const lineOneField = fields[0] as MatInputField;
    expect(lineOneField.key).toBe('line1');
    expect(lineOneField.label).toBe('Line 1');
  });

  it('should apply required to all required sub-fields by default', () => {
    const fields = dbxForgeAddressFields();
    const line1 = fields[0] as MatInputField;
    const row = fields[2] as ContainerField;
    const city = row.fields[0] as MatInputField;
    expect(line1.required).toBe(true);
    expect(city.required).toBe(true);
  });

  it('should relax required when required is false', () => {
    const fields = dbxForgeAddressFields({ required: false });
    const line1 = fields[0] as MatInputField;
    const row = fields[2] as ContainerField;
    const city = row.fields[0] as MatInputField;
    expect(line1.required).toBe(false);
    expect(city.required).toBe(false);
  });

  it('should arrange city, state, zip, and country in a single flex layout container', () => {
    const fields = dbxForgeAddressFields();
    const row = fields[2] as ContainerField;
    expect(row.type).toBe('container');
    expect(row.fields).toHaveLength(4);
    expect((row.wrappers as { type: string }[]).some((w) => w.type === DBX_FORGE_FLEX_WRAPPER_TYPE_NAME)).toBe(true);
  });

  it('should allow overriding individual sub-field configs', () => {
    const fields = dbxForgeAddressFields({ cityField: { label: 'Ville' } });
    const row = fields[2] as ContainerField;
    const city = row.fields[0] as MatInputField;
    expect(city.label).toBe('Ville');
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeAddressGroup()
// ============================================================================

describe('dbxForgeAddressGroup()', () => {
  it('should create a group field with default address key', () => {
    const field = dbxForgeAddressGroup();
    expect(field.type).toBe('group');
    expect(field.key).toBe('address');
  });

  it('should allow overriding key', () => {
    const field = dbxForgeAddressGroup({ key: 'home' });
    expect(field.key).toBe('home');
  });

  it('should include child fields directly on the group', () => {
    const field = dbxForgeAddressGroup();
    // line1, line2, singleLineRow
    expect(field.fields.length).toBe(3);
  });

  it('should respect includeLine2 and includeCountry overrides', () => {
    const field = dbxForgeAddressGroup({ includeLine2: false, includeCountry: false });
    // streetLine, singleLineRow
    expect(field.fields.length).toBe(2);
  });

  it('should propagate required to child fields', () => {
    const field = dbxForgeAddressGroup({ required: false });
    const line1 = field.fields[0] as MatInputField;
    expect(line1.required).toBe(false);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeAddressListField()
// ============================================================================

describe('dbxForgeAddressListField()', () => {
  it('should create an array field with default addresses key', () => {
    const field = dbxForgeAddressListField() as ArrayField;
    expect(field.type).toBe('array');
    expect(field.key).toBe('addresses');
  });

  it('should allow overriding key', () => {
    const field = dbxForgeAddressListField({ key: 'locations' }) as ArrayField;
    expect(field.key).toBe('locations');
  });

  it('should default maxLength (maxAddresses) to 6', () => {
    const field = dbxForgeAddressListField() as ArrayField;
    expect(field.maxLength).toBe(6);
  });

  it('should pass maxAddresses through as maxLength', () => {
    const field = dbxForgeAddressListField({ maxAddresses: 3 }) as ArrayField;
    expect(field.maxLength).toBe(3);
  });

  it('should propagate required to the address template fields', () => {
    const field = dbxForgeAddressListField({ required: false }) as any;
    // The address template fields live inside the outer array wrapper's itemTemplate container.
    const outerWrapper = (field.wrappers as any[]).find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
    const templateFields = outerWrapper.props.itemTemplate[0].fields as MatInputField[];
    expect(templateFields).toBeDefined();
    expect(templateFields[0].required).toBe(false);
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('Usage', () => {
  it('address field factory returns a GroupField', () => {
    expectTypeOf(dbxForgeAddressGroup).returns.toExtend<GroupField>();
  });

  it('address line factory returns a MatInputField-shaped value', () => {
    const field = dbxForgeAddressLineField();
    expectTypeOf(field.type).toEqualTypeOf<'input'>();
  });
});

// ============================================================================
// Regression: nested _formConfig propagation
// ============================================================================

describe('address field _formConfig propagation', () => {
  it('should pull the state field idempotent-transform derivation up to the form config when the state field is nested in the address flex layout', () => {
    // dbxForgeStateField always wires an idempotent transform (toUppercase tied to asCode),
    // which registers a derivation under an auto-generated `__fn__state_N` name in the
    // state field's _formConfig. dbxForgeAddressFields then nests that field inside a
    // flex-layout container, so finalization has to recurse to surface the derivation.
    const fields = dbxForgeAddressFields();
    const result = dbxForgeFinalizeFormConfig({ fields } as never);

    const derivations = result.config.customFnConfig?.derivations ?? {};
    const stateDerivationName = Object.keys(derivations).find((name) => name.startsWith('__fn__state_'));

    expect(stateDerivationName).toBeDefined();
    expect(typeof derivations[stateDerivationName as string]).toBe('function');
  });
});
