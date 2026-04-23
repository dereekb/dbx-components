import { describe, it, expect } from 'vitest';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { dbxForgeDateTimeRangeRow } from './datetimerange.field';
import { type DbxForgeDateTimeFieldDef } from './datetime.field';
import type { RowField } from '@ng-forge/dynamic-forms';

describe('dbxForgeDateTimeRangeRow()', () => {
  function getChildFields(row: RowField): DbxForgeDateTimeFieldDef[] {
    return (row as any).fields as DbxForgeDateTimeFieldDef[];
  }

  it('should create a row field', () => {
    const field = dbxForgeDateTimeRangeRow();
    expect(field.type).toBe('row');
  });

  it('should contain two datetime child fields', () => {
    const field = dbxForgeDateTimeRangeRow();
    const children = getChildFields(field);
    expect(children.length).toBe(2);
    expect(children[0].type).toBe('datetime');
    expect(children[1].type).toBe('datetime');
  });

  it('should use default keys start and end', () => {
    const field = dbxForgeDateTimeRangeRow();
    const children = getChildFields(field);
    expect(children[0].key).toBe('start');
    expect(children[1].key).toBe('end');
  });

  it('should set timeOnly and timeMode REQUIRED on both fields', () => {
    const field = dbxForgeDateTimeRangeRow();
    const children = getChildFields(field);
    expect(children[0].props?.timeOnly).toBe(true);
    expect(children[0].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
    expect(children[1].props?.timeOnly).toBe(true);
    expect(children[1].props?.timeMode).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
  });

  it('should set hideDateHint on both fields', () => {
    const field = dbxForgeDateTimeRangeRow();
    const children = getChildFields(field);
    expect(children[0].props?.hideDateHint).toBe(true);
    expect(children[1].props?.hideDateHint).toBe(true);
  });

  it('should use Start Time and End Time labels', () => {
    const field = dbxForgeDateTimeRangeRow();
    const children = getChildFields(field);
    expect(children[0].label).toBe('Start Time');
    expect(children[1].label).toBe('End Time');
  });

  it('should propagate required to both fields', () => {
    const field = dbxForgeDateTimeRangeRow({ required: true });
    const children = getChildFields(field);
    expect(children[0].required).toBe(true);
    expect(children[1].required).toBe(true);
  });

  it('should propagate shared config to both fields', () => {
    const field = dbxForgeDateTimeRangeRow({
      props: {
        timezone: 'America/Chicago',
        valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY
      }
    });
    const children = getChildFields(field);
    expect(children[0].props?.timezone).toBe('America/Chicago');
    expect(children[0].props?.valueMode).toBe(DbxDateTimeValueMode.MINUTE_OF_DAY);
    expect(children[1].props?.timezone).toBe('America/Chicago');
    expect(children[1].props?.valueMode).toBe(DbxDateTimeValueMode.MINUTE_OF_DAY);
  });

  it('should allow custom start and end keys', () => {
    const field = dbxForgeDateTimeRangeRow({ start: { key: 'sat' }, end: { key: 'eat' } });
    const children = getChildFields(field);
    expect(children[0].key).toBe('sat');
    expect(children[1].key).toBe('eat');
  });

  it('should allow custom labels per field', () => {
    const field = dbxForgeDateTimeRangeRow({
      start: { key: 'sat', label: 'Custom Start' },
      end: { key: 'eat', label: 'Custom End' }
    });
    const children = getChildFields(field);
    expect(children[0].label).toBe('Custom Start');
    expect(children[1].label).toBe('Custom End');
  });
});
