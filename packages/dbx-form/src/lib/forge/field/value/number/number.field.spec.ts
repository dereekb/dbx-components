import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { forgeNumberField, forgeDollarAmountField, FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY } from './number.field';

// ============================================================================
// Runtime Factory Tests - forgeNumberField()
// ============================================================================

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

  it('should set min and max on body and and step in meta', () => {
    const field = forgeNumberField({ key: 'qty', min: 0, max: 50, step: 5 });
    expect(field.min).toBe(0);
    expect(field.max).toBe(50);
    expect((field.meta as any).step).toBe(5);
  });

  it('should map description to hint in props', () => {
    const field = forgeNumberField({ key: 'qty', description: 'Enter quantity' });
    expect(field.props?.hint).toBe('Enter quantity');
  });

  it('should have no default value when none is specified', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.value).toBeUndefined();
  });

  it('should use value when provided', () => {
    const field = forgeNumberField({ key: 'qty', value: 42 });
    expect(field.value).toBe(42);
  });

  it('should allow value of 0', () => {
    const field = forgeNumberField({ key: 'qty', value: 0 });
    expect(field.value).toBe(0);
  });

  it('should leave label undefined when not specified', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.label).toBeUndefined();
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

// ============================================================================
// Runtime Factory Tests - forgeDollarAmountField()
// ============================================================================

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

  it('should use value when provided', () => {
    const field = forgeDollarAmountField({ key: 'price', value: 9.99 });
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
    expect(field.type).toBe('input');
    expect(field.key).toBe('price');
  });

  it('should set label when provided', () => {
    const field = forgeDollarAmountField({ key: 'price', label: 'Amount' });
    expect(field.label).toBe('Amount');
  });

  it('should leave label undefined when not provided', () => {
    const field = forgeDollarAmountField({ key: 'price' });
    expect(field.label).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeDollarAmountField({ key: 'dollars', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
