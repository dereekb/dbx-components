import { describe, it, expect, expectTypeOf } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { DbxForgePhoneFieldConfig } from './phone.field';
import { dbxForgePhoneField } from './phone.field';

// ============================================================================
// DbxForgePhoneFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePhoneFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgePhoneFieldDef>
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
    | 'preferredCountries'
    | 'onlyCountries'
    | 'enableSearch'
    | 'allowExtension'
    | 'autocomplete';

  type ActualKeys = keyof DbxForgePhoneFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgePhoneField()
// ============================================================================

describe('dbxForgePhoneField()', () => {
  it('should create a field with type phone', () => {
    const field = dbxForgePhoneField({ key: 'phone' });
    expect(field.type).toBe('phone');
  });

  it('should set the key from config', () => {
    const field = dbxForgePhoneField({ key: 'myPhone' });
    expect(field.key).toBe('myPhone');
  });

  it('should use a custom label when provided', () => {
    const field = dbxForgePhoneField({ key: 'phone', label: 'Work Phone' });
    expect(field.label).toBe('Work Phone');
  });

  it('should set required when provided', () => {
    const field = dbxForgePhoneField({ key: 'phone', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when provided', () => {
    const field = dbxForgePhoneField({ key: 'phone', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set preferredCountries in props', () => {
    const field = dbxForgePhoneField({ key: 'phone', preferredCountries: ['us', 'ca'] });
    expect(field.props?.preferredCountries).toEqual(['us', 'ca']);
  });

  it('should set onlyCountries in props', () => {
    const field = dbxForgePhoneField({ key: 'phone', onlyCountries: ['us'] });
    expect(field.props?.onlyCountries).toEqual(['us']);
  });

  it('should set enableSearch in props', () => {
    const field = dbxForgePhoneField({ key: 'phone', enableSearch: false });
    expect(field.props?.enableSearch).toBe(false);
  });

  it('should set allowExtension in props', () => {
    const field = dbxForgePhoneField({ key: 'phone', allowExtension: true });
    expect(field.props?.allowExtension).toBe(true);
  });

  it('should set description as hint in props', () => {
    const field = dbxForgePhoneField({ key: 'phone', description: 'Enter your phone' });
    expect(field.props?.hint).toBe('Enter your phone');
  });

  it('should combine multiple props', () => {
    const field = dbxForgePhoneField({
      key: 'phone',
      preferredCountries: ['us'],
      enableSearch: true,
      allowExtension: true,
      description: 'Phone number'
    });
    expect(field.props?.preferredCountries).toEqual(['us']);
    expect(field.props?.enableSearch).toBe(true);
    expect(field.props?.allowExtension).toBe(true);
    expect(field.props?.hint).toBe('Phone number');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgePhoneField({ key: 'phone', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
