/**
 * Exhaustive type and runtime tests for the number slider forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import type { MatSliderField, MatSliderProps } from '@ng-forge/dynamic-forms-material';
import { waitForMs } from '@dereekb/util';
import type { DbxForgeNumberSliderFieldConfig } from './slider.field';
import { dbxForgeNumberSliderField } from './slider.field';
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
    | 'wrappers'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
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
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
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
// Runtime Factory Tests - dbxForgeNumberSliderField()
// ============================================================================

describe('dbxForgeNumberSliderField()', () => {
  // MARK: Field structure
  it('should create a slider field', () => {
    const field = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.type).toBe('slider');
  });

  it('should use the actual key', () => {
    const field = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.key).toBe('rating');
  });

  // MARK: Slider structure
  it('should create a field with slider type', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(slider.type).toBe('slider');
  });

  it('should set the data key on the slider', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(slider.key).toBe('rating');
  });

  it('should set label on the slider', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 });
    expect(slider.label).toBe('Rating');
  });

  // MARK: Min/max/step passthrough
  it('should set min and max on the slider', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', min: 0, max: 10 });
    expect(slider.min).toBe(0);
    expect(slider.max).toBe(10);
  });

  it('should set step in slider props', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 });
    expect(slider.props?.step).toBe(1);
  });

  // MARK: thumbLabel
  it('should default thumbLabel to true in slider props', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(slider.props?.thumbLabel).toBe(true);
  });

  it('should allow disabling thumbLabel', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, thumbLabel: false });
    expect(slider.props?.thumbLabel).toBe(false);
  });

  // MARK: tickInterval
  it('should derive tickInterval from step when step is provided', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, step: 2 });
    expect(slider.props?.tickInterval).toBe(1);
  });

  it('should use explicit tickInterval when provided', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: 5 });
    expect(slider.props?.tickInterval).toBe(5);
  });

  it('should disable ticks when tickInterval is false', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: false });
    expect(slider.props?.tickInterval).toBeUndefined();
  });

  it('should have no tickInterval when neither step nor tickInterval is provided', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10 });
    expect(slider.props?.tickInterval).toBeUndefined();
  });

  // MARK: hint/description mapping
  it('should map description to hint in slider props', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, description: 'Pick a rating' });
    expect(slider.props?.hint).toBe('Pick a rating');
  });

  it('should map hint to slider props', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, hint: 'Drag to select' });
    expect(slider.props?.hint).toBe('Drag to select');
  });

  // MARK: required/readonly passthrough
  it('should set required on the slider', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, required: true });
    expect(slider.required).toBe(true);
  });

  it('should set readonly on the slider', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, readonly: true });
    expect(slider.readonly).toBe(true);
  });

  // MARK: Value
  it('should set value on the slider when provided', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, value: 5 });
    expect(slider.value).toBe(5);
  });

  it('should allow value of 0', () => {
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, value: 0 });
    expect(slider.value).toBe(0);
  });

  // MARK: Logic passthrough
  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const slider = dbxForgeNumberSliderField({ key: 'rating', max: 10, logic });
    expect(slider.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue > formValue.test', kind: 'mustBeGreaterThanTest' }];
    const slider = dbxForgeNumberSliderField({ key: 'validated', max: 100, validators });
    expect(slider.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the field definition', () => {
    const validationMessages: ValidationMessages = { mustBeGreaterThanTest: 'Value must be greater than the first slider' };
    const slider = dbxForgeNumberSliderField({ key: 'validated', max: 100, validationMessages });
    expect(slider.validationMessages).toEqual(validationMessages);
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgeNumberSliderField()
// ============================================================================

describe('scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('config resolution', () => {
    it('should resolve the wrapper field config containing the inner slider', async () => {
      const field = dbxForgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 });
      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe('slider');
    });
  });

  describe('value', () => {
    it('should set and read value through the wrapper', async () => {
      const field = dbxForgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 });
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

  describe('cross-field expression validation', () => {
    /**
     * Settles the fixture with extra time for Observable-based wrapper sync pipelines.
     *
     * The wrapper uses `toObservable` + `combineLatest` + `distinctUntilChanged` for
     * parent ↔ child value sync, which adds microtask-level async delays beyond what
     * a single `detectChanges` + `whenStable` cycle covers.
     */
    async function settleWithWrapperSync(fix: typeof fixture): Promise<void> {
      fix.detectChanges();
      await fix.whenStable();
      await waitForMs(100);
      fix.detectChanges();
      await fix.whenStable();
    }

    it('should validate using formValue to reference sibling field values', async () => {
      console.log('AAA');

      const testField = dbxForgeNumberSliderField({ key: 'test', label: 'Test', min: 0, max: 100 });
      const validatedField = dbxForgeNumberSliderField({
        key: 'validated',
        label: 'Validated',
        min: 0,
        max: 100,
        validators: [{ type: 'custom' as const, expression: 'fieldValue > formValue.test', kind: 'mustBeGreaterThanTest' }],
        validationMessages: { mustBeGreaterThanTest: 'Value must be greater than the first slider' }
      });

      fixture.componentInstance.config.set({ fields: [testField, validatedField] });
      await settleWithWrapperSync(fixture);
      await waitForMs(200);

      console.log('BBB');

      // Set test=50, validated=30 → should be INVALID (30 > 50 is false)
      fixture.componentInstance.setValue({ test: 50, validated: 30 });
      await settleWithWrapperSync(fixture);

      console.log('CCC');

      const streamAfterInvalid = await firstValueFrom(fixture.componentInstance.context.stream$);
      console.log('STREAM AFETER INVALID: ', { streamAfterInvalid });

      expect(streamAfterInvalid.status).toBe('INVALID');
      expect(streamAfterInvalid.isComplete).toBe(false);

      console.log('DDD');

      // Set validated=60 → should be VALID (60 > 50 is true)
      fixture.componentInstance.setValue({ test: 50, validated: 60 });
      await settleWithWrapperSync(fixture);

      console.log('EEE');

      await settleWithWrapperSync(fixture);

      const streamAfterValid = await firstValueFrom(fixture.componentInstance.context.stream$);

      console.log('STREAM AFETER VALID: ', { streamAfterValid });
      expect(streamAfterValid.isComplete).toBe(true);
    });
  });
});
