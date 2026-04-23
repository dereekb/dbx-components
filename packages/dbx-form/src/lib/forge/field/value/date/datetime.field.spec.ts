import { describe, it, expect, expectTypeOf } from 'vitest';
import { of } from 'rxjs';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeDateTimeField, type DbxForgeDateTimeSyncField, type DbxForgeDateTimeFieldDef, type DbxForgeDateTimeFieldConfig } from './datetime.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';

// ============================================================================
// DbxForgeDateTimeFieldConfig - required keys
// ============================================================================

describe('DbxForgeDateTimeFieldConfig', () => {
  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('props', () => {
    it('props is typed as the component props', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['props']>().toEqualTypeOf<DbxForgeDateTimeFieldComponentProps | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeDateTimeFieldDef - type assertions
// ============================================================================

describe('DbxForgeDateTimeFieldDef', () => {
  it('type is required and literal', () => {
    expectTypeOf<DbxForgeDateTimeFieldDef['type']>().toEqualTypeOf<'datetime'>();
  });

  it('value type matches field type', () => {
    expectTypeOf<DbxForgeDateTimeFieldDef['value']>().toEqualTypeOf<unknown>();
  });

  it('props type matches component props', () => {
    expectTypeOf<DbxForgeDateTimeFieldDef['props']>().toEqualTypeOf<DbxForgeDateTimeFieldComponentProps | undefined>();
  });
});

// ============================================================================
// Usage
// ============================================================================

describe('Usage', () => {
  it('should accept valid field configuration', () => {
    const field = {
      type: 'datetime',
      key: 'eventStart',
      label: 'Start',
      value: undefined
    } as const satisfies DbxForgeDateTimeFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'datetime'>();
  });
});

// ============================================================================
// Runtime Tests
// ============================================================================

describe('dbxForgeDateTimeField()', () => {
  it('should create a datetime field with correct type', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime' });
    expect(field.key).toBe('datetime');
    expect(field.type).toBe('datetime');
  });

  it('should set required when specified', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', description: 'Pick a date and time' });
    expect(field.props?.hint).toBe('Pick a date and time');
  });

  it('should set timeMode in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { timeMode: DbxDateTimeFieldTimeMode.OPTIONAL } });
    expect(field.props?.timeMode).toBe(DbxDateTimeFieldTimeMode.OPTIONAL);
  });

  it('should set valueMode in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { valueMode: DbxDateTimeValueMode.DATE_STRING } });
    expect(field.props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set timezone in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { timezone: 'America/New_York' } });
    expect(field.props?.timezone).toBe('America/New_York');
  });

  it('should set custom labels in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { dateLabel: 'Start Date', timeLabel: 'Start Time' } });
    expect(field.props?.dateLabel).toBe('Start Date');
    expect(field.props?.timeLabel).toBe('Start Time');
  });

  it('should set pickerConfig in props', () => {
    const config = { limits: { isFuture: true } };
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { pickerConfig: config } });
    expect(field.props?.pickerConfig).toBe(config);
  });

  it('should set fullDayFieldName in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { fullDayFieldName: 'isAllDay' } });
    expect(field.props?.fullDayFieldName).toBe('isAllDay');
  });

  it('should set getSyncFieldsObs in props', () => {
    const syncFields: DbxForgeDateTimeSyncField[] = [{ syncWith: 'endDate', syncType: 'after' }];
    const getSyncFieldsObs = () => of(syncFields);
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { getSyncFieldsObs } });
    expect(field.props?.getSyncFieldsObs).toBe(getSyncFieldsObs);
  });

  it('should set minuteStep in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { minuteStep: 15 } });
    expect(field.props?.minuteStep).toBe(15);
  });

  it('should set autofillDateWhenTimeIsPicked in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { autofillDateWhenTimeIsPicked: true } });
    expect(field.props?.autofillDateWhenTimeIsPicked).toBe(true);
  });

  it('should set openOnInputClick in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', props: { openOnInputClick: 'input' } });
    expect(field.props?.openOnInputClick).toBe('input');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeDateTimeField({ key: 'datetime', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
