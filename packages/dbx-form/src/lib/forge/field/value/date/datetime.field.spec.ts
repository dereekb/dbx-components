import { describe, it, expect } from 'vitest';
import { forgeDateField, forgeDateTimeField, forgeDateRangeField, forgeDateTimeRangeField, forgeFixedDateRangeField } from './datetime.field';

describe('forgeDateField()', () => {
  it('should create a datepicker field with correct type', () => {
    const field = forgeDateField({ key: 'startDate', label: 'Start Date' });
    expect(field.type).toBe('datepicker');
    expect(field.key).toBe('startDate');
    expect(field.label).toBe('Start Date');
  });

  it('should set required when specified', () => {
    const field = forgeDateField({ key: 'startDate', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeDateField({ key: 'startDate', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set minDate when specified', () => {
    const minDate = new Date('2024-01-01');
    const field = forgeDateField({ key: 'startDate', minDate });
    expect(field.minDate).toEqual(minDate);
  });

  it('should set maxDate when specified', () => {
    const maxDate = new Date('2025-12-31');
    const field = forgeDateField({ key: 'startDate', maxDate });
    expect(field.maxDate).toEqual(maxDate);
  });

  it('should accept string minDate and maxDate', () => {
    const field = forgeDateField({ key: 'startDate', minDate: '2024-01-01', maxDate: '2025-12-31' });
    expect(field.minDate).toBe('2024-01-01');
    expect(field.maxDate).toBe('2025-12-31');
  });

  it('should set startAt when specified', () => {
    const startAt = new Date('2024-06-15');
    const field = forgeDateField({ key: 'startDate', startAt });
    expect(field.startAt).toEqual(startAt);
  });

  it('should map description to hint in props', () => {
    const field = forgeDateField({ key: 'startDate', description: 'Pick a date' });
    expect(field.props?.hint).toBe('Pick a date');
  });

  it('should not include props when no description is provided', () => {
    const field = forgeDateField({ key: 'startDate' });
    expect(field.props).toBeUndefined();
  });

  it('should provide empty label when not specified', () => {
    const field = forgeDateField({ key: 'startDate' });
    expect(field.label).toBe('');
  });
});

describe('forgeDateTimeField()', () => {
  it('should throw an error indicating it is not yet implemented', () => {
    expect(() => forgeDateTimeField({ key: 'datetime' })).toThrow('Not yet implemented');
  });
});

describe('forgeDateRangeField()', () => {
  it('should throw an error indicating it is not yet implemented', () => {
    expect(() => forgeDateRangeField({ key: 'dateRange' })).toThrow('Not yet implemented');
  });
});

describe('forgeDateTimeRangeField()', () => {
  it('should throw an error indicating it is not yet implemented', () => {
    expect(() => forgeDateTimeRangeField({ key: 'dateTimeRange' })).toThrow('Not yet implemented');
  });
});

describe('forgeFixedDateRangeField()', () => {
  it('should throw an error indicating it is not yet implemented', () => {
    expect(() => forgeFixedDateRangeField({ key: 'fixedRange' })).toThrow('Not yet implemented');
  });
});
