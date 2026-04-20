/**
 * Exhaustive type and runtime tests for the textarea forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { DynamicText, LogicConfig, SchemaApplicationConfig, ValidatorConfig, ValidationMessages } from '@ng-forge/dynamic-forms';
import type { MatTextareaField } from '@ng-forge/dynamic-forms-material';
import type { DbxForgeTextAreaFieldConfig } from './textarea.field';
import { dbxForgeTextAreaField } from './textarea.field';

// ============================================================================
// DbxForgeTextAreaFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeTextAreaFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<MatTextareaField>
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
    | '__fieldDef'
    // Field-specific config
    | 'rows'
    | 'defaultValue'
    // From FieldAutocompleteAttributeOptionRef
    | 'autocomplete'
    // From Partial<TransformStringFunctionConfigRef>
    | 'transform';

  type ActualKeys = keyof DbxForgeTextAreaFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeTextAreaFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('field-specific config keys', () => {
    it('rows', () => {
      expectTypeOf<DbxForgeTextAreaFieldConfig['rows']>().toEqualTypeOf<number | undefined>();
    });

    it('defaultValue', () => {
      expectTypeOf<DbxForgeTextAreaFieldConfig['defaultValue']>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('inherited optional keys', () => {
    it('value is string', () => {
      expectTypeOf<DbxForgeTextAreaFieldConfig['value']>().toEqualTypeOf<string | undefined>();
    });
  });
});

// ============================================================================
// MatTextareaField - Exhaustive Whitelist
// ============================================================================

describe('MatTextareaField - Exhaustive Whitelist', () => {
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

  type ActualKeys = keyof MatTextareaField;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<MatTextareaField['key']>().toEqualTypeOf<string>();
    });

    it('type is required and literal', () => {
      expectTypeOf<MatTextareaField['type']>().toEqualTypeOf<'textarea'>();
    });
  });

  describe('value type', () => {
    it('value is string', () => {
      expectTypeOf<MatTextareaField['value']>().toEqualTypeOf<string | undefined>();
    });
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('MatTextareaField - Usage', () => {
  it('should accept valid textarea field configuration', () => {
    const field = {
      type: 'textarea',
      key: 'bio',
      label: 'Biography',
      value: '',
      props: { rows: 5, resize: 'vertical' }
    } as const satisfies MatTextareaField;

    expectTypeOf(field.type).toEqualTypeOf<'textarea'>();
    expectTypeOf(field.value).toEqualTypeOf<''>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeTextAreaField()
// ============================================================================

describe('dbxForgeTextAreaField()', () => {
  it('should create a textarea field with correct type', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', label: 'Biography' });
    expect(field.type).toBe('textarea');
    expect(field.key).toBe('bio');
    expect(field.label).toBe('Biography');
  });

  it('should set required when specified', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should default rows to 3 in props', () => {
    const field = dbxForgeTextAreaField({ key: 'bio' });
    expect(field.props?.rows).toBe(3);
  });

  it('should set custom rows in props', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', rows: 5 });
    expect(field.props?.rows).toBe(5);
  });

  it('should set minLength and maxLength', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', minLength: 10, maxLength: 500 });
    expect(field.minLength).toBe(10);
    expect(field.maxLength).toBe(500);
  });

  it('should set pattern from string', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', pattern: '^[a-z]+$' });
    expect(field.pattern).toBe('^[a-z]+$');
  });

  it('should set pattern from RegExp', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', pattern: /^[a-z]+$/ });
    expect(field.pattern).toBe('^[a-z]+$');
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', description: 'Tell us about yourself' });
    expect(field.props?.hint).toBe('Tell us about yourself');
  });

  it('should set placeholder on field', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', placeholder: 'Type here' });
    expect((field as any).placeholder).toBe('Type here');
  });

  it('should provide empty string as default value', () => {
    const field = dbxForgeTextAreaField({ key: 'bio' });
    expect(field.value).toBe('');
  });

  it('should use defaultValue when provided', () => {
    const field = dbxForgeTextAreaField({ key: 'bio', defaultValue: 'default text' });
    expect(field.value).toBe('default text');
  });

  it('should provide empty label when not specified', () => {
    const field = dbxForgeTextAreaField({ key: 'bio' });
    expect(field.label).toBe('');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeTextAreaField({ key: 'bio', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
