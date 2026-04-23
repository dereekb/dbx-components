import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeDateRangeRow } from './daterange.field';
import { type DbxForgeDateTimeFieldDef } from './datetime.field';
import type { RowField } from '@ng-forge/dynamic-forms';

describe('dbxForgeDateRangeRow()', () => {
  function getChildFields(row: RowField): DbxForgeDateTimeFieldDef[] {
    return (row as any).fields as DbxForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = dbxForgeDateRangeRow();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = dbxForgeDateRangeRow();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = dbxForgeDateRangeRow();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should allow custom start and end keys', () => {
    const field = dbxForgeDateRangeRow({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('from');
    expect(children[1].key).toBe('to');
  });

  it('should set timeMode to NONE on both fields', () => {
    const field = dbxForgeDateRangeRow();
    const children = getChildFields(field);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.NONE);
  });

  it('should set sync fields so start syncs with end and vice versa', async () => {
    const field = dbxForgeDateRangeRow();
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'end', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'start', syncType: 'before' }]);
  });

  it('should use custom keys in sync fields', async () => {
    const field = dbxForgeDateRangeRow({ start: { key: 'from' }, end: { key: 'to' } });
    const children = getChildFields(field);

    const startSync = await firstValueFrom(children[0].props!.getSyncFieldsObs!());
    expect(startSync).toEqual([{ syncWith: 'to', syncType: 'after' }]);

    const endSync = await firstValueFrom(children[1].props!.getSyncFieldsObs!());
    expect(endSync).toEqual([{ syncWith: 'from', syncType: 'before' }]);
  });

  it('should propagate required to both fields', () => {
    const field = dbxForgeDateRangeRow({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = dbxForgeDateRangeRow({
      props: {
        timezone: 'America/New_York',
        valueMode: DbxDateTimeValueMode.DATE_STRING
      }
    });
    const children = getChildFields(field);
    expect(children[0].props?.timezone).toBe('America/New_York');
    expect(children[0].props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
    expect(children[1].props?.timezone).toBe('America/New_York');
    expect(children[1].props?.valueMode).toBe(DbxDateTimeValueMode.DATE_STRING);
  });

  it('should allow per-field overrides', () => {
    const pickerConfig = { limits: { isFuture: true } };
    const field = dbxForgeDateRangeRow({
      start: { key: 'startDate', description: 'Start description', props: { pickerConfig } },
      end: { key: 'endDate', description: 'End description' }
    });
    const children = getChildFields(field);
    expect(children[0].props?.hint).toBe('Start description');
    expect(children[0].props?.pickerConfig).toBe(pickerConfig);
    expect(children[1].props?.hint).toBe('End description');
  });

  it('should set dateLabel to Start and End', () => {
    const field = dbxForgeDateRangeRow();
    const children = getChildFields(field);
    expect(children[0].props?.dateLabel).toBe('Start');
    expect(children[1].props?.dateLabel).toBe('End');
  });
});
