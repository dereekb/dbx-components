import { describe, it, expect } from 'vitest';
import { DOLLAR_AMOUNT_PRECISION } from '@dereekb/util';
import { forgeNumberField, forgeNumberSliderField, forgeDollarAmountField } from './number.field';

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

  it('should default value to 0', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.value).toBe(0);
  });

  it('should use defaultValue when provided', () => {
    const field = forgeNumberField({ key: 'qty', defaultValue: 42 });
    expect(field.value).toBe(42);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeNumberField({ key: 'qty' });
    expect(field.label).toBe('');
  });
});

describe('forgeNumberSliderField()', () => {
  it('should create a slider field with correct type', () => {
    const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', max: 10 });
    expect(field.type).toBe('slider');
    expect(field.key).toBe('rating');
    expect(field.label).toBe('Rating');
  });

  it('should set min, max, and step in props', () => {
    const field = forgeNumberSliderField({ key: 'rating', min: 0, max: 10, step: 1 });
    expect(field.props?.min).toBe(0);
    expect(field.props?.max).toBe(10);
    expect(field.props?.step).toBe(1);
  });

  it('should default thumbLabel to true', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.props?.thumbLabel).toBe(true);
  });

  it('should allow disabling thumbLabel', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, thumbLabel: false });
    expect(field.props?.thumbLabel).toBe(false);
  });

  it('should derive tickInterval from step when step is provided', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 2 });
    expect(field.props?.tickInterval).toBe(1);
  });

  it('should use explicit tickInterval when provided', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: 5 });
    expect(field.props?.tickInterval).toBe(5);
  });

  it('should disable ticks when tickInterval is false', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, step: 1, tickInterval: false });
    expect(field.props?.tickInterval).toBeUndefined();
  });

  it('should set required when specified', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should default value to 0', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.value).toBe(0);
  });

  it('should use defaultValue when provided', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10, defaultValue: 5 });
    expect(field.value).toBe(5);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeNumberSliderField({ key: 'rating', max: 10 });
    expect(field.label).toBe('');
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

  it('should use defaultValue when provided', () => {
    const field = forgeDollarAmountField({ key: 'price', defaultValue: 9.99 });
    expect(field.value).toBe(9.99);
  });
});
