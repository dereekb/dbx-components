import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { timezoneStringSearchFunction } from './timezone';

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
});
