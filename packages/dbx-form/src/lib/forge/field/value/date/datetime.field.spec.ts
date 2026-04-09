import { describe, it, expect } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { forgeDateField, forgeDateTimeField, forgeDateRangeField, forgeDateTimeRangeField, forgeFixedDateRangeField, type ForgeDateTimeSyncField, type ForgeDateTimeFieldDef } from './datetime.field';
import type { RowField } from '@ng-forge/dynamic-forms';

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
  function getChildFields(row: RowField): ForgeDateTimeFieldDef[] {
    return (row as any).fields as ForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = forgeDateRangeField();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = forgeDateRangeField();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = forgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should allow custom start and end keys', () => {
    const field = forgeDateRangeField({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('from');
    expect(children[1].key).toBe('to');
  });

  it('should set timeMode to NONE on both fields', () => {
    const field = forgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
  });

  it('should set sync fields so start syncs with end and vice versa', async () => {
    const field = forgeDateRangeField();
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'end', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'start', syncType: 'before' }]);
  });

  it('should use custom keys in sync fields', async () => {
    const field = forgeDateRangeField({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'to', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'from', syncType: 'before' }]);
  });

  it('should propagate required to both fields', () => {
    const field = forgeDateRangeField({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = forgeDateRangeField({
      timezone: 'America/New_York',
      valueMode: DbxDateTimeValueMode.DATE_STRING
    });
    const children = getChildFields(field);
    expect(children[0].props?.timezone).toBe('America/New_York');
    expect(children[0].props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
    expect(children[1].props?.timezone).toBe('America/New_York');
    expect(children[1].props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should allow per-field overrides', () => {
    const pickerConfig = { limits: { isFuture: true } };
    const field = forgeDateRangeField({
      start: { key: 'startDate', description: 'Start description', pickerConfig },
      end: { key: 'endDate', description: 'End description' }
    });
    const children = getChildFields(field);
    expect(children[0].props?.hint).toBe('Start description');
    expect(children[0].props?.pickerConfig).toBe(pickerConfig);
    expect(children[1].props?.hint).toBe('End description');
  });

  it('should set dateLabel to Start and End', () => {
    const field = forgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.dateLabel).toBe('Start');
    expect(children[1].props?.dateLabel).toBe('End');
  });
});

describe('forgeDateTimeRangeField()', () => {
  function getChildFields(row: RowField): ForgeDateTimeFieldDef[] {
    return (row as any).fields as ForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = forgeDateTimeRangeField();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = forgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = forgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should set timeOnly and timeMode REQUIRED on both fields', () => {
    const field = forgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.timeOnly).toBe(true);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
    expect(children[1].props?.timeOnly).toBe(true);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
  });

  it('should set hideDateHint on both fields', () => {
    const field = forgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.hideDateHint).toBe(true);
    expect(children[1].props?.hideDateHint).toBe(true);
  });

  it('should use Start Time and End Time labels', () => {
    const field = forgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].label).toBe('Start Time');
    expect(children[1].label).toBe('End Time');
  });

  it('should propagate required to both fields', () => {
    const field = forgeDateTimeRangeField({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = forgeDateTimeRangeField({
      timezone: 'America/Chicago',
      valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY
    });
    const children = getChildFields(field);
    expect(children[0].props?.timezone).toBe('America/Chicago');
    expect(children[0].props?.valueMode).toBe(DbxDateTimeValueMode.MINUTE_OF_DAY);
    expect(children[1].props?.timezone).toBe('America/Chicago');
    expect(children[1].props?.valueMode).toBe(DbxDateTimeValueMode.MINUTE_OF_DAY);
  });

  it('should allow custom start and end keys', () => {
    const field = forgeDateTimeRangeField({ start: { key: 'sat' }, end: { key: 'eat' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('sat');
    expect(children[1].key).toBe('eat');
  });

  it('should allow custom labels per field', () => {
    const field = forgeDateTimeRangeField({
      start: { key: 'sat', label: 'Custom Start' },
      end: { key: 'eat', label: 'Custom End' }
    });
    const children = getChildFields(field);
    expect(children[0].label).toBe('Custom Start');
    expect(children[1].label).toBe('Custom End');
  });
});

describe('forgeFixedDateRangeField()', () => {
  function innerField(wrapper: ReturnType<typeof forgeFixedDateRangeField>) {
    return (wrapper.props as any)?.fields?.[0] as any;
  }

  it('should create a wrapper with the correct type', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange' });
    expect(field.type).toBe('dbx-forge-form-field');
  });

  it('should contain an inner fixeddaterange field with the correct key', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange' });
    const inner = innerField(field);
    expect(inner.key).toBe('fixedRange');
    expect(inner.type).toBe('fixeddaterange');
  });

  it('should set required on the inner field', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', required: true });
    expect(innerField(field).required).toBe(true);
  });

  it('should set readonly on the inner field', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', readonly: true });
    expect(innerField(field).readonly).toBe(true);
  });

  it('should map description to hint on the wrapper', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', description: 'Picks a 10-day range' });
    expect(field.props?.hint).toBe('Picks a 10-day range');
  });

  it('should set label on the wrapper', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', label: 'My Range' });
    expect(field.label).toBe('My Range');
  });

  it('should set dateRangeInput in inner field props', () => {
    const dateRangeInput = { type: 'weeks_range' as any, distance: 1 };
    const field = forgeFixedDateRangeField({ key: 'fixedRange', dateRangeInput });
    expect(innerField(field).props?.dateRangeInput).toBe(dateRangeInput);
  });

  it('should set selectionMode in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', selectionMode: 'normal' });
    expect(innerField(field).props?.selectionMode).toBe('normal');
  });

  it('should set valueMode in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', valueMode: DbxDateTimeValueMode.DATE_STRING });
    expect(innerField(field).props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set fullDayInUTC in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', fullDayInUTC: true });
    expect(innerField(field).props?.fullDayInUTC).toBe(true);
  });

  it('should set pickerConfig in inner field props', () => {
    const pickerConfig = { limits: { min: 'today_start' as any } };
    const field = forgeFixedDateRangeField({ key: 'fixedRange', pickerConfig });
    expect(innerField(field).props?.pickerConfig).toBe(pickerConfig);
  });

  it('should set timezone in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', timezone: 'America/New_York' });
    expect(innerField(field).props?.timezone).toBe('America/New_York');
  });

  it('should set showTimezone in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', showTimezone: false });
    expect(innerField(field).props?.showTimezone).toBe(false);
  });

  it('should set showRangeInput in inner field props', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange', showRangeInput: false });
    expect(innerField(field).props?.showRangeInput).toBe(false);
  });

  it('should not include inner field props when no configuration is provided', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange' });
    expect(innerField(field).props).toBeUndefined();
  });

  it('should provide empty label when not specified', () => {
    const field = forgeFixedDateRangeField({ key: 'fixedRange' });
    expect(field.label).toBe('');
  });
});
