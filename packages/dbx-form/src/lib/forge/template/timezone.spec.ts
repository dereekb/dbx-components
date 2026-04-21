import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { dbxForgeTimezoneStringField } from './timezone';

describe('dbxForgeTimezoneStringField()', () => {
  it('should create a dbx-searchable-text field', () => {
    const field = dbxForgeTimezoneStringField();
    expect(field.type).toBe('dbx-searchable-text');
  });

  it('should default key to "timezone"', () => {
    expect(dbxForgeTimezoneStringField().key).toBe('timezone');
  });

  it('should default label to "Timezone"', () => {
    expect(dbxForgeTimezoneStringField().label).toBe('Timezone');
  });

  it('should allow overriding key', () => {
    expect(dbxForgeTimezoneStringField({ key: 'tz' }).key).toBe('tz');
  });

  it('should allow overriding label', () => {
    expect(dbxForgeTimezoneStringField({ label: 'Select Timezone' }).label).toBe('Select Timezone');
  });

  it('should set required when specified', () => {
    expect(dbxForgeTimezoneStringField({ required: true }).required).toBe(true);
  });

  it('should set readonly when specified', () => {
    expect(dbxForgeTimezoneStringField({ readonly: true }).readonly).toBe(true);
  });

  it('should configure search and display props', () => {
    const field = dbxForgeTimezoneStringField();
    expect(field.props).toBeDefined();
    expect(field.props?.search).toBeDefined();
    expect(field.props?.displayForValue).toBeDefined();
    expect(field.props?.searchOnEmptyText).toBe(true);
    expect(field.props?.allowStringValues).toBe(false);
    expect(field.props?.showClearValue).toBe(true);
  });

  it('should leave showSelectedValue unset so component defaults to !allowStringValues', () => {
    // allowStringValues: false → component computes showSelected = showSelectedValue ?? !allowStringValues = true.
    // Leaving it undefined is the expected default.
    const field = dbxForgeTimezoneStringField();
    expect(field.props?.showSelectedValue).toBeUndefined();
  });

  it('should work with no arguments', () => {
    expect(() => dbxForgeTimezoneStringField()).not.toThrow();
  });

  it('should work with empty config', () => {
    expect(() => dbxForgeTimezoneStringField({})).not.toThrow();
  });

  describe('search and display behavior', () => {
    it('should return the selected timezone when searching for it again', async () => {
      // Regression: re-selecting the same timezone must find it in search results.
      const field = dbxForgeTimezoneStringField();
      const searchFn = field.props!.search;

      const results = await firstValueFrom(searchFn(''));
      const selected = results[0];
      expect(selected).toBeDefined();

      const reSearchResults = await firstValueFrom(searchFn(selected.value as string));
      const found = reSearchResults.find((r) => r.value === selected.value);
      expect(found).toBeDefined();
    });

    it('should produce a string display label for the same value across repeated calls', async () => {
      // Regression: the display function must always return string labels, never [object Object].
      const field = dbxForgeTimezoneStringField();
      const displayFn = field.props!.displayForValue;
      const testValue = 'America/Chicago';

      const firstDisplay = await firstValueFrom(displayFn([{ value: testValue }]));
      const secondDisplay = await firstValueFrom(displayFn([{ value: testValue }]));

      expect(typeof firstDisplay[0].label).toBe('string');
      expect(firstDisplay[0].label).toBe(testValue);
      expect(typeof secondDisplay[0].label).toBe('string');
      expect(secondDisplay[0].label).toBe(testValue);
    });
  });
});
