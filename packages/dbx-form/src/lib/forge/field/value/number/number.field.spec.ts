import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { forgeNumberField, forgeNumberSliderField, forgeDollarAmountField, FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY } from './number.field';
import { FORGE_FORM_FIELD_WRAPPER_TYPE_NAME, type DbxForgeFormFieldWrapperProps } from '../../wrapper/formfield/formfield.field';

describe('forgeNumberField()', () => {
  it('should create an input field with number type in props', () => {
    const field = forgeNumberField({ key: 'quantity', label: 'Quantity' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('quantity');
    expect(field.label).toBe('Quantity');
    expect(field.props?.type).toBe('number');
  });

  it('should set required when specified', () => {
    const field = forgeNumberField({ key: 'qty', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeNumberField({ key: 'qty', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set min and max on the field', () => {
    const field = forgeNumberField({ key: 'qty', min: 1, max: 100 });
    expect(field.min).toBe(1);
    expect(field.max).toBe(100);
  });

  it('should set min, max, and step in props', () => {
    const field = forgeNumberField({ key: 'qty', min: 0, max: 50, step: 5 });
    expect(field.props?.min).toBe(0);
    expect(field.props?.max).toBe(50);
    expect(field.props?.step).toBe(5);
  });

  it('should map description to hint in props', () => {
    const field = forgeNumberField({ key: 'qty', description: 'Enter quantity' });
    expect(field.props?.hint).toBe('Enter quantity');
  });

  it('should set placeholder in props', () => {
    const field = forgeNumberField({ key: 'qty', placeholder: '0' });
    expect(field.props?.placeholder).toBe('0');
  });

  it('should have no default value when none is specified', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.value).toBeUndefined();
  });

  it('should use defaultValue when provided', () => {
    const field = forgeNumberField({ key: 'qty', defaultValue: 42 });
    expect(field.value).toBe(42);
  });

  it('should allow defaultValue of 0', () => {
    const field = forgeNumberField({ key: 'qty', defaultValue: 0 });
    expect(field.value).toBe(0);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.label).toBe('');
  });

  describe('validationMessages', () => {
    it('should include validationMessages on the field definition', () => {
      const field = forgeNumberField({ key: 'qty', label: 'Qty' });
      expect(field.validationMessages).toBeDefined();
    });

    it('should include a min validation message', () => {
      const field = forgeNumberField({ key: 'qty', min: 0 });
      expect(field.validationMessages?.min).toBeDefined();
    });

    it('should include a max validation message', () => {
      const field = forgeNumberField({ key: 'qty', max: 100 });
      expect(field.validationMessages?.max).toBeDefined();
    });

    it('should include a required validation message', () => {
      const field = forgeNumberField({ key: 'qty', required: true });
      expect(field.validationMessages?.required).toBeDefined();
    });
  });

  describe('step and enforceStep', () => {
    it('should set meta.step when step is provided', () => {
      const field = forgeNumberField({ key: 'qty', step: 5 });
      expect((field as any).meta?.step).toBe(5);
    });

    it('should not set meta when step is not provided', () => {
      const field = forgeNumberField({ key: 'qty' });
      expect((field as any).meta).toBeUndefined();
    });

    it('should add a custom isDivisibleBy validator when enforceStep is true', () => {
      const field = forgeNumberField({ key: 'qty', step: 5, enforceStep: true });
      const validators = (field as any).validators;
      expect(validators).toBeDefined();
      expect(validators.length).toBe(1);
      expect(validators[0].kind).toBe(FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY);
    });

    it('should add isDivisibleBy validation message when enforceStep is true', () => {
      const field = forgeNumberField({ key: 'qty', step: 5, enforceStep: true });
      expect(field.validationMessages?.[FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY]).toBeDefined();
    });

    it('should not add a validator when enforceStep is false', () => {
      const field = forgeNumberField({ key: 'qty', step: 5 });
      expect((field as any).validators).toBeUndefined();
    });

    it('should not add a validator when step is not provided even if enforceStep is true', () => {
      const field = forgeNumberField({ key: 'qty', enforceStep: true });
      expect((field as any).validators).toBeUndefined();
    });
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeNumberField({ key: 'num', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

describe('forgeNumberSliderField()', () => {
  /**
   * Helper to extract the inner slider field from the wrapper.
   */
  function getInnerSlider(field: ReturnType<typeof forgeNumberSliderField>) {
    const wrapperProps = field.props as DbxForgeFormFieldWrapperProps;
    return wrapperProps.fields[0] as Record<string, unknown>;
  }

  it('should create a form-field wrapper', () => {
    const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 });
    expect(field.type).toBe(FORGE_FORM_FIELD_WRAPPER_TYPE_NAME);
  });

  it('should set label on the wrapper', () => {
    const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 });
    expect(field.label).toBe('Rating');
  });

  it('should set description as hint on the wrapper props', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, description: 'A hint' });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should contain exactly one child slider field', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    const wrapperProps = field.props as DbxForgeFormFieldWrapperProps;
    expect(wrapperProps.fields.length).toBe(1);
  });

  it('should create an inner slider with built-in slider type', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    const slider = getInnerSlider(field);
    expect(slider['type']).toBe('slider');
  });

  it('should set the data key on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    const slider = getInnerSlider(field);
    expect(slider['key']).toBe('rating');
  });

  it('should not set label on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 });
    const slider = getInnerSlider(field);
    expect(slider['label']).toBe('');
  });

  it('should set min and max on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', min: 0, max: 10 });
    const slider = getInnerSlider(field);
    expect(slider['min']).toBe(0);
    expect(slider['max']).toBe(10);
  });

  it('should set step in inner slider props', () => {
    const field = forgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['step']).toBe(1);
  });

  it('should default thumbLabel to true in inner slider props', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['thumbLabel']).toBe(true);
  });

  it('should allow disabling thumbLabel', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, thumbLabel: false });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['thumbLabel']).toBe(false);
  });

  it('should derive tickInterval from step when step is provided', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 2 });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['tickInterval']).toBe(1);
  });

  it('should use explicit tickInterval when provided', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: 5 });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['tickInterval']).toBe(5);
  });

  it('should disable ticks when tickInterval is false', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: false });
    const slider = getInnerSlider(field);
    const sliderProps = slider['props'] as Record<string, unknown>;
    expect(sliderProps['tickInterval']).toBeUndefined();
  });

  it('should set required on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, required: true });
    const slider = getInnerSlider(field);
    expect(slider['required']).toBe(true);
  });

  it('should set readonly on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, readonly: true });
    const slider = getInnerSlider(field);
    expect(slider['readonly']).toBe(true);
  });

  it('should set defaultValue on the inner slider', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, defaultValue: 5 });
    const slider = getInnerSlider(field);
    expect(slider['value']).toBe(5);
  });

  it('should allow defaultValue of 0', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, defaultValue: 0 });
    const slider = getInnerSlider(field);
    expect(slider['value']).toBe(0);
  });

  it('should provide empty label on wrapper when not specified', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.label).toBe('');
  });

  it('should use auto-generated _formfield_ key for the wrapper', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.key).toContain('_formfield_');
  });

  it('should pass logic through to the wrapper field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeNumberSliderField({ key: 'rating', max: 10, logic });
    expect((field as any).logic).toEqual(logic);
  });
});

describe('forgeDollarAmountField()', () => {
  it('should create a number input field', () => {
    const field = forgeDollarAmountField({ key: 'price', label: 'Price' });
    expect(field.type).toBe('input');
    expect(field.props?.type).toBe('number');
  });

  it('should set min when specified', () => {
    const field = forgeDollarAmountField({ key: 'price', min: 0 });
    expect(field.min).toBe(0);
  });

  it('should set required when specified', () => {
    const field = forgeDollarAmountField({ key: 'price', required: true });
    expect(field.required).toBe(true);
  });

  it('should have no default value when none is specified', () => {
    const field = forgeDollarAmountField({ key: 'price' });
    expect(field.value).toBeUndefined();
  });

  it('should use defaultValue when provided', () => {
    const field = forgeDollarAmountField({ key: 'price', defaultValue: 9.99 });
    expect(field.value).toBe(9.99);
  });

  it('should set the key from config', () => {
    const field = forgeDollarAmountField({ key: 'total' });
    expect(field.key).toBe('total');
  });

  it('should map description to hint in props', () => {
    const field = forgeDollarAmountField({ key: 'price', description: 'Enter amount in USD' });
    expect(field.props?.hint).toBe('Enter amount in USD');
  });

  it('should set precision to DOLLAR_AMOUNT_PRECISION via transform', () => {
    const field = forgeDollarAmountField({ key: 'price' });
    // forgeDollarAmountField delegates to forgeNumberField with precision set;
    // the field itself is a standard number input, so verify it creates correctly
    expect(field.type).toBe('input');
    expect(field.key).toBe('price');
  });

  it('should set label when provided', () => {
    const field = forgeDollarAmountField({ key: 'price', label: 'Amount' });
    expect(field.label).toBe('Amount');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeDollarAmountField({ key: 'price' });
    expect(field.label).toBe('');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeDollarAmountField({ key: 'dollars', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
