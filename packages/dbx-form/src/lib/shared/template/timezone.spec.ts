import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { timezoneInfoForSystem } from '@dereekb/date';
import { AUTO_TIMEZONE_STRING_VALUE_LABEL, DISPLAY_FOR_TIMEZONE_STRING_VALUE, timezoneStringSearchFunction } from './timezone';

describe('timezoneStringSearchFunction()', () => {
  it('should return results for an empty search string', async () => {
    const searchFn = timezoneStringSearchFunction();
    const results = await firstValueFrom(searchFn(''));
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return results for a valid search string', async () => {
    const searchFn = timezoneStringSearchFunction();
    const results = await firstValueFrom(searchFn('America'));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].value).toContain('America');
  });

  it('should not throw when search text is a non-string value coerced to empty string', async () => {
    // Regression: mat-autocomplete can push an object into the FormControl,
    // which flows into the search pipeline. The directive coerces it to '',
    // but the search function must also handle empty strings gracefully.
    const searchFn = timezoneStringSearchFunction();
    const results = await firstValueFrom(searchFn(''));
    expect(results.length).toBeGreaterThan(0);
  });

  describe('auto option', () => {
    it('should return the auto option first for an empty search string', async () => {
      const searchFn = timezoneStringSearchFunction();
      const results = await firstValueFrom(searchFn(''));
      const systemTimezone = timezoneInfoForSystem().timezone;

      expect(results[0].value).toBe(systemTimezone);
      expect(results[0].meta?.auto).toBe(true);
      expect(results[0].skipDisplayCache).toBe(true);
    });

    it('should also include the system timezone as a regular result for an empty search string', async () => {
      const searchFn = timezoneStringSearchFunction();
      const results = await firstValueFrom(searchFn(''));
      const systemTimezone = timezoneInfoForSystem().timezone;

      const regularResults = results.slice(1);
      expect(regularResults.some((x) => x.meta?.auto)).toBe(false);
      expect(regularResults.some((x) => x.value === systemTimezone)).toBe(true);
    });

    it('should return the auto option first when searching for its label', async () => {
      const searchFn = timezoneStringSearchFunction();
      const results = await firstValueFrom(searchFn('AUT'));
      expect(results[0].meta?.auto).toBe(true);
    });

    it('should not return the auto option for a search that does not match its label', async () => {
      const searchFn = timezoneStringSearchFunction();
      const results = await firstValueFrom(searchFn('America'));
      expect(results.some((x) => x.meta?.auto)).toBe(false);
    });
  });
});

describe('DISPLAY_FOR_TIMEZONE_STRING_VALUE', () => {
  it('should label a timezone value with its timezone and abbreviation', async () => {
    const results = await firstValueFrom(DISPLAY_FOR_TIMEZONE_STRING_VALUE([{ value: 'America/Chicago' }]));
    expect(results[0].label).toBe('America/Chicago');
    expect(results[0].sublabel).toMatch(/^C[SD]T$/);
  });

  it('should label the auto option as auto with the timezone in the sublabel', async () => {
    const searchFn = timezoneStringSearchFunction();
    const [autoValue] = await firstValueFrom(searchFn(''));
    const results = await firstValueFrom(DISPLAY_FOR_TIMEZONE_STRING_VALUE([autoValue]));

    expect(results[0].value).toBe(autoValue.value);
    expect(results[0].label).toBe(AUTO_TIMEZONE_STRING_VALUE_LABEL);
    expect(results[0].sublabel).toContain(autoValue.value);
  });
});
