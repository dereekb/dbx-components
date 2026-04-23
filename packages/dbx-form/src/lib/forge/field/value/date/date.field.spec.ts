import { describe, it, expect } from 'vitest';
import { dbxForgeDateField } from './date.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

describe('dbxForgeDateField()', () => {
  it('should create a datepicker field with correct type', () => {
    const field = dbxForgeDateField({ key: 'startDate', label: 'Start Date' });
    expect(field.type).toBe('datepicker');
    expect(field.key).toBe('startDate');
    expect(field.label).toBe('Start Date');
  });

  it('should set required when specified', () => {
    const field = dbxForgeDateField({ key: 'startDate', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeDateField({ key: 'startDate', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set minDate when specified', () => {
    const minDate = new Date('2024-01-01');
    const field = dbxForgeDateField({ key: 'startDate', minDate });
    expect(field.minDate).toEqual(minDate);
  });

  it('should set maxDate when specified', () => {
    const maxDate = new Date('2025-12-31');
    const field = dbxForgeDateField({ key: 'startDate', maxDate });
    expect(field.maxDate).toEqual(maxDate);
  });

  it('should accept string minDate and maxDate', () => {
    const field = dbxForgeDateField({ key: 'startDate', minDate: '2024-01-01', maxDate: '2025-12-31' });
    expect(field.minDate).toBe('2024-01-01');
    expect(field.maxDate).toBe('2025-12-31');
  });

  it('should set startAt when specified', () => {
    const startAt = new Date('2024-06-15');
    const field = dbxForgeDateField({ key: 'startDate', startAt });
    expect(field.startAt).toEqual(startAt);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeDateField({ key: 'startDate', description: 'Pick a date' });
    expect(field.props?.hint).toBe('Pick a date');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeDateField({ key: 'startDate', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
