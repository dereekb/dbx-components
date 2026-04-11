import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { forgeTimezoneStringField } from './timezone';
import type { DbxForgeSearchableTextFieldDef } from '../field/selection/searchable/searchable.field.directive';

describe('forgeTimezoneStringField()', () => {
  function innerField(config?: Parameters<typeof forgeTimezoneStringField>[0]): DbxForgeSearchableTextFieldDef {
    const wrapper = forgeTimezoneStringField(config);
    return wrapper.props!.fields[0] as unknown as DbxForgeSearchableTextFieldDef;
  }

  it('should create a wrapper field with type dbx-forge-form-field', () => {
    const wrapper = forgeTimezoneStringField();
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should contain an inner searchable text field with type dbx-searchable-text', () => {
    expect(innerField().type).toBe('dbx-searchable-text');
  });

  it('should default to key "timezone" on the inner field', () => {
    expect(innerField().key).toBe('timezone');
  });

  it('should default to label "Timezone" on the wrapper', () => {
    const wrapper = forgeTimezoneStringField();
    expect(wrapper.label).toBe('Timezone');
  });

  it('should allow overriding key', () => {
    expect(innerField({ key: 'tz' }).key).toBe('tz');
  });

  it('should allow overriding label', () => {
    const wrapper = forgeTimezoneStringField({ label: 'Select Timezone' });
    expect(wrapper.label).toBe('Select Timezone');
  });

  it('should set required on the inner field when specified', () => {
    expect(innerField({ required: true }).required).toBe(true);
  });

  it('should set readonly on the inner field when specified', () => {
    expect(innerField({ readonly: true }).readonly).toBe(true);
  });

  it('should configure search and display props on the inner field', () => {
    const field = innerField();
    expect(field.props).toBeDefined();
    expect(field.props?.search).toBeDefined();
    expect(field.props?.displayForValue).toBeDefined();
    expect(field.props?.searchOnEmptyText).toBe(true);
    expect(field.props?.allowStringValues).toBe(false);
    expect(field.props?.showClearValue).toBe(true);
  });

  it('should work with no arguments', () => {
    expect(() => forgeTimezoneStringField()).not.toThrow();
  });

  it('should work with empty config', () => {
    expect(() => forgeTimezoneStringField({})).not.toThrow();
  });

  describe('search and display behavior', () => {
    function getSearchFn() {
      return innerField().props!.search;
    }

    function getDisplayFn() {
      return innerField().props!.displayForValue;
    }

    it('should return the selected timezone when searching for it again', async () => {
      // Regression: re-selecting the same timezone must find it in search results.
      const searchFn = getSearchFn();
      const results = await firstValueFrom(searchFn(''));
      const selected = results[0];
      expect(selected).toBeDefined();

      const reSearchResults = await firstValueFrom(searchFn(selected.value as string));
      const found = reSearchResults.find((r) => r.value === selected.value);
      expect(found).toBeDefined();
    });

    it('should produce a string display label for the same value across repeated calls', async () => {
      // Regression: the display function must always return string labels,
      // never [object Object].
      const displayFn = getDisplayFn();
      const testValue = 'America/Chicago';

      const firstDisplay = await firstValueFrom(displayFn([{ value: testValue }]));
      const secondDisplay = await firstValueFrom(displayFn([{ value: testValue }]));

      expect(typeof firstDisplay[0].label).toBe('string');
      expect(firstDisplay[0].label).toBe(testValue);
      expect(typeof secondDisplay[0].label).toBe('string');
      expect(secondDisplay[0].label).toBe(testValue);
    });

    it('should configure showSelectedValue behavior (selected value shown, input hidden until focus)', () => {
      // The timezone field sets allowStringValues: false, which means
      // showSelectedValue defaults to true. This drives the CSS classes
      // that hide the search input and show the selected display value.
      const field = innerField();
      expect(field.props?.allowStringValues).toBe(false);

      // showSelectedValue is not explicitly set, so it defaults to !allowStringValues = true.
      // The component computes: showSelected = props.showSelectedValue ?? !props.allowStringValues
      expect(field.props?.showSelectedValue).toBeUndefined();
    });
  });
});
