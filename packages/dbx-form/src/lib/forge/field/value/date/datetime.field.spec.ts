import { describe, it, expect, expectTypeOf } from 'vitest';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration, type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeDateField, dbxForgeDateTimeField, dbxForgeDateRangeField, dbxForgeDateTimeRangeField, dbxForgeFixedDateRangeField, type DbxForgeDateTimeSyncField, type DbxForgeDateTimeFieldDef, type DbxForgeDateTimeFieldConfig } from './datetime.field';
import type { RowField, LogicConfig, DynamicText, SchemaApplicationConfig, ValidatorConfig, ValidationMessages, FieldMeta, BaseValueField } from '@ng-forge/dynamic-forms';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import type { Maybe, TimezoneString, DateOrDayString, ArrayOrValue } from '@dereekb/util';
import type { ObservableOrValueGetter } from '@dereekb/rxjs';
import type { DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';

// ============================================================================
// DbxForgeDateTimeFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeDateTimeFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeDateTimeFieldDef>
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
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // Phantom brand
    | '__fieldDef'
    // Field-specific config (from DbxForgeDateTimeFieldConfig)
    | 'timeOnly'
    | 'timeMode'
    | 'valueMode'
    | 'dateLabel'
    | 'timeLabel'
    | 'allDayLabel'
    | 'atTimeLabel'
    | 'minDate'
    | 'maxDate'
    | 'timezone'
    | 'showTimezone'
    | 'pickerConfig'
    | 'hideDateHint'
    | 'hideDatePicker'
    | 'alwaysShowDateInput'
    | 'showClearButton'
    | 'presets'
    | 'timeDate'
    | 'autofillDateWhenTimeIsPicked'
    | 'fullDayFieldName'
    | 'fullDayInUTC'
    | 'minuteStep'
    | 'inputOutputDebounceTime'
    | 'getSyncFieldsObs';

  type ActualKeys = keyof DbxForgeDateTimeFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('field-specific config keys', () => {
    it('timeOnly', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['timeOnly']>().toEqualTypeOf<boolean | undefined>();
    });

    it('timeMode', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['timeMode']>().toEqualTypeOf<DbxDateTimeFieldTimeMode | undefined>();
    });

    it('valueMode', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['valueMode']>().toEqualTypeOf<DbxDateTimeValueMode | undefined>();
    });

    it('dateLabel', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['dateLabel']>().toEqualTypeOf<string | undefined>();
    });

    it('timeLabel', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['timeLabel']>().toEqualTypeOf<string | undefined>();
    });

    it('allDayLabel', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['allDayLabel']>().toEqualTypeOf<string | undefined>();
    });

    it('atTimeLabel', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['atTimeLabel']>().toEqualTypeOf<string | undefined>();
    });

    it('minDate', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['minDate']>().toEqualTypeOf<string | Date | undefined>();
    });

    it('maxDate', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['maxDate']>().toEqualTypeOf<string | Date | undefined>();
    });

    it('timezone', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['timezone']>().toEqualTypeOf<Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>> | undefined>();
    });

    it('showTimezone', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['showTimezone']>().toEqualTypeOf<Maybe<boolean> | undefined>();
    });

    it('pickerConfig', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['pickerConfig']>().toEqualTypeOf<ObservableOrValueGetter<DbxDateTimePickerConfiguration> | undefined>();
    });

    it('hideDateHint', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['hideDateHint']>().toEqualTypeOf<boolean | undefined>();
    });

    it('hideDatePicker', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['hideDatePicker']>().toEqualTypeOf<boolean | undefined>();
    });

    it('alwaysShowDateInput', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['alwaysShowDateInput']>().toEqualTypeOf<boolean | undefined>();
    });

    it('showClearButton', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['showClearButton']>().toEqualTypeOf<Maybe<boolean> | undefined>();
    });

    it('presets', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['presets']>().toEqualTypeOf<ObservableOrValueGetter<DateTimePresetConfiguration[]> | undefined>();
    });

    it('timeDate', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['timeDate']>().toEqualTypeOf<Maybe<ObservableOrValueGetter<Maybe<DateOrDayString>>> | undefined>();
    });

    it('autofillDateWhenTimeIsPicked', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['autofillDateWhenTimeIsPicked']>().toEqualTypeOf<boolean | undefined>();
    });

    it('fullDayFieldName', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['fullDayFieldName']>().toEqualTypeOf<string | undefined>();
    });

    it('fullDayInUTC', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['fullDayInUTC']>().toEqualTypeOf<boolean | undefined>();
    });

    it('minuteStep', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['minuteStep']>().toEqualTypeOf<Maybe<number> | undefined>();
    });

    it('inputOutputDebounceTime', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['inputOutputDebounceTime']>().toEqualTypeOf<number | undefined>();
    });

    it('getSyncFieldsObs', () => {
      expectTypeOf<DbxForgeDateTimeFieldConfig['getSyncFieldsObs']>().toEqualTypeOf<(() => Observable<ArrayOrValue<DbxForgeDateTimeSyncField>>) | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeDateTimeFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeDateTimeFieldDef - Exhaustive Whitelist', () => {
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
    // From BaseValueField
    | 'value'
    | 'placeholder';

  type ActualKeys = keyof DbxForgeDateTimeFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

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
    const field = dbxForgeDateTimeField({ key: 'datetime', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
    expect(field.props?.timeMode).toBe(DbxDateTimeFieldTimeMode.OPTIONAL);
  });

  it('should set valueMode in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', valueMode: DbxDateTimeValueMode.DATE_STRING });
    expect(field.props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set timezone in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', timezone: 'America/New_York' });
    expect(field.props?.timezone).toBe('America/New_York');
  });

  it('should set custom labels in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', dateLabel: 'Start Date', timeLabel: 'Start Time' });
    expect(field.props?.dateLabel).toBe('Start Date');
    expect(field.props?.timeLabel).toBe('Start Time');
  });

  it('should set pickerConfig in props', () => {
    const config = { limits: { isFuture: true } };
    const field = dbxForgeDateTimeField({ key: 'datetime', pickerConfig: config });
    expect(field.props?.pickerConfig).toBe(config);
  });

  it('should set fullDayFieldName in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', fullDayFieldName: 'isAllDay' });
    expect(field.props?.fullDayFieldName).toBe('isAllDay');
  });

  it('should set getSyncFieldsObs in props', () => {
    const syncFields: DbxForgeDateTimeSyncField[] = [{ syncWith: 'endDate', syncType: 'after' }];
    const getSyncFieldsObs = () => of(syncFields);
    const field = dbxForgeDateTimeField({ key: 'datetime', getSyncFieldsObs });
    expect(field.props?.getSyncFieldsObs).toBe(getSyncFieldsObs);
  });

  it('should set minuteStep in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', minuteStep: 15 });
    expect(field.props?.minuteStep).toBe(15);
  });

  it('should set autofillDateWhenTimeIsPicked in props', () => {
    const field = dbxForgeDateTimeField({ key: 'datetime', autofillDateWhenTimeIsPicked: true });
    expect(field.props?.autofillDateWhenTimeIsPicked).toBe(true);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeDateTimeField({ key: 'datetime', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

describe('dbxForgeDateRangeField()', () => {
  function getChildFields(row: RowField): DbxForgeDateTimeFieldDef[] {
    return (row as any).fields as DbxForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = dbxForgeDateRangeField();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = dbxForgeDateRangeField();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = dbxForgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should allow custom start and end keys', () => {
    const field = dbxForgeDateRangeField({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('from');
    expect(children[1].key).toBe('to');
  });

  it('should set timeMode to NONE on both fields', () => {
    const field = dbxForgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
  });

  it('should set sync fields so start syncs with end and vice versa', async () => {
    const field = dbxForgeDateRangeField();
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'end', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'start', syncType: 'before' }]);
  });

  it('should use custom keys in sync fields', async () => {
    const field = dbxForgeDateRangeField({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'to', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'from', syncType: 'before' }]);
  });

  it('should propagate required to both fields', () => {
    const field = dbxForgeDateRangeField({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = dbxForgeDateRangeField({
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
    const field = dbxForgeDateRangeField({
      start: { key: 'startDate', description: 'Start description', pickerConfig },
      end: { key: 'endDate', description: 'End description' }
    });
    const children = getChildFields(field);
    expect(children[0].props?.hint).toBe('Start description');
    expect(children[0].props?.pickerConfig).toBe(pickerConfig);
    expect(children[1].props?.hint).toBe('End description');
  });

  it('should set dateLabel to Start and End', () => {
    const field = dbxForgeDateRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.dateLabel).toBe('Start');
    expect(children[1].props?.dateLabel).toBe('End');
  });
});

describe('dbxForgeDateTimeRangeField()', () => {
  function getChildFields(row: RowField): DbxForgeDateTimeFieldDef[] {
    return (row as any).fields as DbxForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = dbxForgeDateTimeRangeField();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = dbxForgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = dbxForgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should set timeOnly and timeMode REQUIRED on both fields', () => {
    const field = dbxForgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.timeOnly).toBe(true);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
    expect(children[1].props?.timeOnly).toBe(true);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
  });

  it('should set hideDateHint on both fields', () => {
    const field = dbxForgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].props?.hideDateHint).toBe(true);
    expect(children[1].props?.hideDateHint).toBe(true);
  });

  it('should use Start Time and End Time labels', () => {
    const field = dbxForgeDateTimeRangeField();
    const children = getChildFields(field);
    expect(children[0].label).toBe('Start Time');
    expect(children[1].label).toBe('End Time');
  });

  it('should propagate required to both fields', () => {
    const field = dbxForgeDateTimeRangeField({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = dbxForgeDateTimeRangeField({
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
    const field = dbxForgeDateTimeRangeField({ start: { key: 'sat' }, end: { key: 'eat' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('sat');
    expect(children[1].key).toBe('eat');
  });

  it('should allow custom labels per field', () => {
    const field = dbxForgeDateTimeRangeField({
      start: { key: 'sat', label: 'Custom Start' },
      end: { key: 'eat', label: 'Custom End' }
    });
    const children = getChildFields(field);
    expect(children[0].label).toBe('Custom Start');
    expect(children[1].label).toBe('Custom End');
  });
});

describe('dbxForgeFixedDateRangeField()', () => {
  function innerField(wrapper: ReturnType<typeof dbxForgeFixedDateRangeField>) {
    return (wrapper as any).fields[0] as any;
  }

  it('should create a wrapper field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange' });
    expect(field.type).toBe('wrapper');
  });

  it('should contain an inner fixeddaterange field with the correct key', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange' });
    const inner = innerField(field);
    expect(inner.key).toBe('fixedRange');
    expect(inner.type).toBe('fixeddaterange');
  });

  it('should set required on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', required: true });
    expect(innerField(field).required).toBe(true);
  });

  it('should set readonly on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', readonly: true });
    expect(innerField(field).readonly).toBe(true);
  });

  it('should map description to hint on the inner field props', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', description: 'Picks a 10-day range' });
    expect(innerField(field).props?.hint).toBe('Picks a 10-day range');
  });

  it('should set label on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', label: 'My Range' });
    expect(innerField(field).label).toBe('My Range');
  });

  it('should set dateRangeInput on the inner field', () => {
    const dateRangeInput = { type: 'weeks_range' as any, distance: 1 };
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', dateRangeInput });
    expect(innerField(field).dateRangeInput).toBe(dateRangeInput);
  });

  it('should set selectionMode on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', selectionMode: 'normal' });
    expect(innerField(field).selectionMode).toBe('normal');
  });

  it('should set valueMode on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', valueMode: DbxDateTimeValueMode.DATE_STRING });
    expect(innerField(field).valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should set fullDayInUTC on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', fullDayInUTC: true });
    expect(innerField(field).fullDayInUTC).toBe(true);
  });

  it('should set pickerConfig on the inner field', () => {
    const pickerConfig = { limits: { min: 'today_start' as any } };
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', pickerConfig });
    expect(innerField(field).pickerConfig).toBe(pickerConfig);
  });

  it('should set timezone on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', timezone: 'America/New_York' });
    expect(innerField(field).timezone).toBe('America/New_York');
  });

  it('should set showTimezone on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', showTimezone: false });
    expect(innerField(field).showTimezone).toBe(false);
  });

  it('should set showRangeInput on the inner field', () => {
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', showRangeInput: false });
    expect(innerField(field).showRangeInput).toBe(false);
  });

  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeFixedDateRangeField({ key: 'fixedRange', logic });
    expect((innerField(field) as any).logic).toEqual(logic);
  });
});
