import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { forgeDateField, forgeDateTimeField, forgeDateRangeField, forgeDateTimeRangeField, forgeFixedDateRangeField, type ForgeDateTimeSyncField } from './datetime.field';

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
  it('should create a datetime field with correct type', () => {
    const field = forgeDateTimeField({ key: 'datetime' });
    expect(field.key).toBe('datetime');
    expect(field.type).toBe('datetime');
  });

  it('should set required when specified', () => {
    const field = forgeDateTimeField({ key: 'datetime', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeDateTimeField({ key: 'datetime', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', description: 'Pick a date and time' });
    expect(field.props?.hint).toBe('Pick a date and time');
  });

  it('should set timeMode in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
    expect(field.props?.timeMode).toBe(DbxDateTimeFieldTimeMode.OPTIONAL);
  });

  it('should set valueMode in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', valueMode: DbxDateTimeValueMode.DATE_STRING });
    expect(field.props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set timezone in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', timezone: 'America/New_York' });
    expect(field.props?.timezone).toBe('America/New_York');
  });

  it('should set custom labels in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', dateLabel: 'Start Date', timeLabel: 'Start Time' });
    expect(field.props?.dateLabel).toBe('Start Date');
    expect(field.props?.timeLabel).toBe('Start Time');
  });

  it('should set pickerConfig in props', () => {
    const config = { limits: { isFuture: true } };
    const field = forgeDateTimeField({ key: 'datetime', pickerConfig: config });
    expect(field.props?.pickerConfig).toBe(config);
  });

  it('should set fullDayFieldName in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', fullDayFieldName: 'isAllDay' });
    expect(field.props?.fullDayFieldName).toBe('isAllDay');
  });

  it('should set getSyncFieldsObs in props', () => {
    const syncFields: ForgeDateTimeSyncField[] = [{ syncWith: 'endDate', syncType: 'after' }];
    const getSyncFieldsObs = () => of(syncFields);
    const field = forgeDateTimeField({ key: 'datetime', getSyncFieldsObs });
    expect(field.props?.getSyncFieldsObs).toBe(getSyncFieldsObs);
  });

  it('should map showTime=false to timeMode=none for backward compatibility', () => {
    const field = forgeDateTimeField({ key: 'datetime', showTime: false });
    expect(field.props?.timeMode).toBe('none');
  });

  it('should not override explicit timeMode with showTime', () => {
    const field = forgeDateTimeField({ key: 'datetime', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL, showTime: false });
    expect(field.props?.timeMode).toBe(DbxDateTimeFieldTimeMode.OPTIONAL);
  });

  it('should set minuteStep in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', minuteStep: 15 });
    expect(field.props?.minuteStep).toBe(15);
  });

  it('should set autofillDateWhenTimeIsPicked in props', () => {
    const field = forgeDateTimeField({ key: 'datetime', autofillDateWhenTimeIsPicked: true });
    expect(field.props?.autofillDateWhenTimeIsPicked).toBe(true);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeDateTimeField({ key: 'datetime' });
    expect(field.label).toBe('');
  });
});

describe('forgeDateRangeField()', () => {
  it('should create a date range field with correct key', () => {
    const field = forgeDateRangeField({ key: 'dateRange' });
    expect(field.key).toBe('dateRange');
    expect(field.type).toBeDefined();
  });
});

describe('forgeDateTimeRangeField()', () => {
  it('should create a date time range field with correct key', () => {
    const field = forgeDateTimeRangeField({ key: 'dateTimeRange' });
    expect(field.key).toBe('dateTimeRange');
    expect(field.type).toBeDefined();
  });
});

describe('forgeFixedDateRangeField()', () => {
  it('should create a fixed date range field with correct key', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange' });
    expect(field.key).toBe('fixedRange');
    expect(field.type).toBeDefined();
  });
});
