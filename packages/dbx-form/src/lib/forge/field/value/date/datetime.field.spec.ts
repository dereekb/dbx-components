import { describe, it, expect, expectTypeOf } from 'vitest';
import { of, type Observable } from 'rxjs';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeDateTimeField, type DbxForgeDateTimeSyncField, type DbxForgeDateTimeFieldDef, type DbxForgeDateTimeFieldConfig } from './datetime.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import type { Maybe, TimezoneString, DateOrDayString, ArrayOrValue } from '@dereekb/util';
import type { ObservableOrValueGetter } from '@dereekb/rxjs';
import type { DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';

// ============================================================================
// DbxForgeDateTimeFieldConfig - field-specific config key types
// ============================================================================

describe('DbxForgeDateTimeFieldConfig - field-specific config keys', () => {
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
