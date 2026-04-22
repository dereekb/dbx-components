import { describe, it, expect } from 'vitest';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeFixedDateRangeField } from './fixeddaterange.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

describe('dbxForgeFixedDateRangeField()', () => {
  it('should create a fixeddaterange field with the correct key', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange' });
    expect(field.type).toBe('fixeddaterange');
    expect(field.key).toBe('fixedRange');
  });

  it('should add the form-field wrapper', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange' });
    expect((field as any).wrappers).toBeDefined();
    expect((field as any).wrappers.map((w: any) => w.type)).toContain('dbx-forge-form-field-wrapper');
  });

  it('should set required on the field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly on the field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', description: 'Picks a 10-day range' });
    expect(field.props?.hint).toBe('Picks a 10-day range');
  });

  it('should set label on the field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', label: 'My Range' });
    expect(field.label).toBe('My Range');
  });

  it('should set dateRangeInput in props', () => {
    const dateRangeInput = { type: 'weeks_range' as any, distance: 1 };
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { dateRangeInput } });
    expect(field.props?.dateRangeInput).toBe(dateRangeInput);
  });

  it('should set selectionMode "normal" in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { selectionMode: 'normal' } });
    expect(field.props?.selectionMode).toBe('normal');
  });

  it('should set selectionMode "arbitrary" in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { selectionMode: 'arbitrary' } });
    expect(field.props?.selectionMode).toBe('arbitrary');
  });

  it('should set selectionMode "arbitrary_quick" in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { selectionMode: 'arbitrary_quick' } });
    expect(field.props?.selectionMode).toBe('arbitrary_quick');
  });

  it('should set valueMode in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { valueMode: DbxDateTimeValueMode.DATE_STRING } });
    expect(field.props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set fullDayInUTC in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { fullDayInUTC: true } });
    expect(field.props?.fullDayInUTC).toBe(true);
  });

  it('should set pickerConfig in props', () => {
    const pickerConfig = { limits: { min: 'today_start' as any } };
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { pickerConfig } });
    expect(field.props?.pickerConfig).toBe(pickerConfig);
  });

  it('should set timezone in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { timezone: 'America/New_York' } });
    expect(field.props?.timezone).toBe('America/New_York');
  });

  it('should set showTimezone in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { showTimezone: false } });
    expect(field.props?.showTimezone).toBe(false);
  });

  it('should set showRangeInput in props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { showRangeInput: false } });
    expect(field.props?.showRangeInput).toBe(false);
  });

  it('should pass presets through to props', () => {
    const presets = [{ label: 'Today', logicalDate: 'now' as const }];
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', props: { presets } });
    expect(field.props?.presets).toBe(presets);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
