/**
 * Exhaustive type and runtime tests for the number slider forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import type { MatSliderField, MatSliderProps } from '@ng-forge/dynamic-forms-material';
import { waitForMs } from '@dereekb/util';
import type { DbxForgeNumberSliderFieldConfig } from './slider.field';
import { forgeNumberSliderField } from './slider.field';
import { FORGE_FORM_FIELD_WRAPPER_TYPE_NAME, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { getFormFieldWrapperInnerField } from '../../wrapper/formfield/formfield.field.util';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';

// ============================================================================
// DbxForgeNumberSliderFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeNumberSliderFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<MatSliderField>
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
    // From SliderField (via Partial<Omit<MatSliderField, 'key' | 'type'>>)
    | 'minValue'
    | 'maxValue'
    | 'step'
    // Phantom brand
    | '__fieldDef'
    // Field-specific config
    | 'thumbLabel'
    | 'tickInterval';

  type ActualKeys = keyof DbxForgeNumberSliderFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('field-specific config keys', () => {
    it('thumbLabel', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['thumbLabel']>().toEqualTypeOf<boolean | undefined>();
    });

    it('tickInterval', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['tickInterval']>().toEqualTypeOf<false | number | undefined>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('value is number', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['value']>().toEqualTypeOf<number | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('hint', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['hint']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('description', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['description']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });

    it('schemas', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['schemas']>().toEqualTypeOf<SchemaApplicationConfig[] | undefined>();
    });

    it('minValue', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['minValue']>().toEqualTypeOf<number | undefined>();
    });

    it('maxValue', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['maxValue']>().toEqualTypeOf<number | undefined>();
    });

    it('step', () => {
      expectTypeOf<DbxForgeNumberSliderFieldConfig['step']>().toEqualTypeOf<number | undefined>();
    });
  });
});

// ============================================================================
// MatSliderField - Exhaustive Whitelist
// ============================================================================

describe('MatSliderField - Exhaustive Whitelist', () => {
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
    | 'placeholder'
    // From SliderField
    | 'minValue'
    | 'maxValue'
    | 'step';

  type ActualKeys = keyof MatSliderField;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal slider', () => {
    expectTypeOf<MatSliderField['type']>().toEqualTypeOf<'slider'>();
  });

  it('value is number', () => {
    expectTypeOf<MatSliderField['value']>().toEqualTypeOf<number | undefined>();
  });

  it('props is MatSliderProps', () => {
    expectTypeOf<MatSliderField['props']>().toEqualTypeOf<MatSliderProps | undefined>();
  });
});

// ============================================================================
// DbxForgeFormFieldWrapperFieldDef<MatSliderField> - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeFormFieldWrapperFieldDef<MatSliderField> - Exhaustive Whitelist', () => {
  type WrapperFieldDef = DbxForgeFormFieldWrapperFieldDef<MatSliderField>;

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

  type ActualKeys = keyof WrapperFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-forge-form-field', () => {
    expectTypeOf<WrapperFieldDef['type']>().toEqualTypeOf<typeof FORGE_FORM_FIELD_WRAPPER_TYPE_NAME>();
  });

  it('value is Record<string, unknown>', () => {
    expectTypeOf<WrapperFieldDef['value']>().toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it('props contains a field property typed as MatSliderField', () => {
    expectTypeOf<WrapperFieldDef['props']>().toMatchTypeOf<{ field: MatSliderField } | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('MatSliderField - Usage', () => {
  it('should accept valid slider field configuration', () => {
    const field = {
      type: 'slider',
      key: 'rating',
      label: 'Rating',
      value: 5,
      min: 0,
      max: 10,
      step: 1
    } as const satisfies MatSliderField;

    expectTypeOf(field.type).toEqualTypeOf<'slider'>();
    expectTypeOf(field.value).toEqualTypeOf<5>();
  });
});

// ============================================================================
// Runtime Factory Tests - forgeNumberSliderField()
// ============================================================================

describe('forgeNumberSliderField()', () => {
  // MARK: Wrapper structure
  it('should create a form-field wrapper', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.type).toBe(FORGE_FORM_FIELD_WRAPPER_TYPE_NAME);
  });

  it('should use auto-generated _formfield_ key for the wrapper', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.key).toContain('_form_field_');
  });

  it('should contain an inner slider field in wrapper props', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(getFormFieldWrapperInnerField(field)).toBeDefined();
  });

  // MARK: Inner slider structure
  it('should create an inner slider with built-in slider type', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10 }));
    expect(slider.type).toBe('slider');
  });

  it('should set the data key on the inner slider', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10 }));
    expect(slider.key).toBe('rating');
  });

  it('should set label on the inner slider', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 }));
    expect(slider.label).toBe('Rating');
  });

  // MARK: Min/max/step passthrough
  it('should set min and max on the inner slider', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', min: 0, max: 10 }));
    expect(slider.min).toBe(0);
    expect(slider.max).toBe(10);
  });

  it('should set step in inner slider props', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 }));
    expect(slider.props?.step).toBe(1);
  });

  // MARK: thumbLabel
  it('should default thumbLabel to true in inner slider props', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10 }));
    expect(slider.props?.thumbLabel).toBe(true);
  });

  it('should allow disabling thumbLabel', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, thumbLabel: false }));
    expect(slider.props?.thumbLabel).toBe(false);
  });

  // MARK: tickInterval
  it('should derive tickInterval from step when step is provided', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, step: 2 }));
    expect(slider.props?.tickInterval).toBe(1);
  });

  it('should use explicit tickInterval when provided', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: 5 }));
    expect(slider.props?.tickInterval).toBe(5);
  });

  it('should disable ticks when tickInterval is false', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: false }));
    expect(slider.props?.tickInterval).toBeUndefined();
  });

  it('should have no tickInterval when neither step nor tickInterval is provided', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10 }));
    expect(slider.props?.tickInterval).toBeUndefined();
  });

  // MARK: hint/description mapping
  it('should map description to hint in inner slider props', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, description: 'Pick a rating' }));
    expect(slider.props?.hint).toBe('Pick a rating');
  });

  it('should map hint to inner slider props', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, hint: 'Drag to select' }));
    expect(slider.props?.hint).toBe('Drag to select');
  });

  // MARK: required/readonly passthrough
  it('should set required on the inner slider', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, required: true }));
    expect(slider.required).toBe(true);
  });

  it('should set readonly on the inner slider', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, readonly: true }));
    expect(slider.readonly).toBe(true);
  });

  // MARK: Value
  it('should set value on the inner slider when provided', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, value: 5 }));
    expect(slider.value).toBe(5);
  });

  it('should allow value of 0', () => {
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, value: 0 }));
    expect(slider.value).toBe(0);
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const slider = getFormFieldWrapperInnerField(forgeNumberSliderField({ key: 'rating', max: 10, logic }));
    expect(slider.logic).toEqual(logic);
  });
});

// ============================================================================
// Runtime Form Scenarios - forgeNumberSliderField()
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
    it('should resolve the wrapper field config containing the inner slider', async () => {
      const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 });
      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe(FORGE_FORM_FIELD_WRAPPER_TYPE_NAME);
    });
  });

  describe('value', () => {
    it('should set and read value through the wrapper', async () => {
      const field = forgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 });
      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.setValue({ rating: 7 });

      fixture.detectChanges();
      await waitForMs(0);
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());
      expect(value).toEqual({ rating: 7 });
    });
  });
});
