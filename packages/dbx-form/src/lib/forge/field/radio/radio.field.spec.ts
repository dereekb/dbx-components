import { describe, it, expect, expectTypeOf } from 'vitest';
import { DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS, dbxForgeRadioField } from './radio.field';
import { DBX_FORGE_FORM_FIELD_WRAPPER_NAME } from '../wrapper/formfield/formfield.wrapper';
import type { FieldOption, LogicConfig } from '@ng-forge/dynamic-forms';
import type { MatRadioField } from '@ng-forge/dynamic-forms-material';
import type { Maybe } from '@dereekb/util';
import type { DbxForgeRadioFieldConfig, DbxForgeRadioFieldLayout } from './radio.field';

// ============================================================================
// DbxForgeRadioFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeRadioFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<MatRadioField<T>>
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
    | 'validateWhenHidden'
    | 'addons'
    | '__fieldDef'
    // From RadioField
    | 'options'
    // Field-specific config
    | 'layout';

  type ActualKeys = keyof DbxForgeRadioFieldConfig<number>;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('layout', () => {
    expectTypeOf<DbxForgeRadioFieldConfig['layout']>().toEqualTypeOf<Maybe<DbxForgeRadioFieldLayout> | undefined>();
  });

  it('options preserve the generic value type', () => {
    expectTypeOf<NonNullable<DbxForgeRadioFieldConfig<number>['options']>>().toEqualTypeOf<readonly FieldOption<number>[]>();
  });
});

// ============================================================================
// MatRadioField - Output
// ============================================================================

describe('MatRadioField - Output', () => {
  it('type is the radio literal', () => {
    expectTypeOf<MatRadioField<number>['type']>().toEqualTypeOf<'radio'>();
  });

  it('options are required', () => {
    expectTypeOf<MatRadioField<number>['options']>().toEqualTypeOf<readonly FieldOption<number>[]>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeRadioField()
// ============================================================================

describe('dbxForgeRadioField()', () => {
  const testOptions = [
    { label: 'Small', value: 's' },
    { label: 'Medium', value: 'm' },
    { label: 'Large', value: 'l' }
  ];

  it('should create a radio field with correct type', () => {
    const field = dbxForgeRadioField({ key: 'size', label: 'Size', options: testOptions });
    expect(field.type).toBe('radio');
    expect(field.key).toBe('size');
    expect(field.label).toBe('Size');
  });

  it('should wrap the field in the form-field wrapper', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions });
    expect(field.wrappers?.map((x) => x.type)).toEqual([DBX_FORGE_FORM_FIELD_WRAPPER_NAME]);
  });

  it('should set options on the field', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions });
    expect(field.options).toEqual(testOptions);
  });

  it('should set required when specified', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map hint to hint in props', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions, hint: 'Pick a size' });
    expect(field.props?.hint).toBe('Pick a size');
  });

  it('should pass labelPosition and color through props', () => {
    const field = dbxForgeRadioField({ key: 'size', options: testOptions, props: { labelPosition: 'before', color: 'accent' } });
    expect(field.props?.labelPosition).toBe('before');
    expect(field.props?.color).toBe('accent');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeRadioField({ key: 'size', options: testOptions, logic });
    expect((field as any).logic).toEqual(logic);
  });

  it('should work with numeric option values', () => {
    const numOptions = [
      { label: '$120+', value: 120 },
      { label: '$150+', value: 150 }
    ];
    const field = dbxForgeRadioField({ key: 'minPay', options: numOptions, value: 150 });
    expect(field.value).toBe(150);
    expect(field.options).toEqual(numOptions);
  });

  it('should allow a null option value', () => {
    const nullableOptions = [
      { label: 'Any', value: null },
      { label: '$120+', value: 120 }
    ];
    const field = dbxForgeRadioField<Maybe<number>>({ key: 'minPay', options: nullableOptions, nullable: true, value: null });
    expect(field.options).toEqual(nullableOptions);
    expect(field.nullable).toBe(true);
    expect(field.value).toBeNull();
  });

  describe('layout', () => {
    it('should not add the vertical class by default', () => {
      const field = dbxForgeRadioField({ key: 'size', options: testOptions });
      expect(field.className).toBeUndefined();
    });

    it('should not add the vertical class for the horizontal layout', () => {
      const field = dbxForgeRadioField({ key: 'size', options: testOptions, layout: 'horizontal' });
      expect(field.className).toBeUndefined();
    });

    it('should add the vertical class for the vertical layout', () => {
      const field = dbxForgeRadioField({ key: 'size', options: testOptions, layout: 'vertical' });
      expect(field.className).toBe(DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS);
    });

    it('should merge the vertical class with an existing className', () => {
      const field = dbxForgeRadioField({ key: 'size', options: testOptions, layout: 'vertical', className: 'my-radio' });
      expect(field.className).toBe(`my-radio ${DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS}`);
    });

    it('should not copy layout onto the field definition', () => {
      const field = dbxForgeRadioField({ key: 'size', options: testOptions, layout: 'vertical' });
      expect('layout' in field).toBe(false);
    });
  });
});
