import { allTimezoneStrings, allKnownTimezoneStrings, timezoneInfoForSystem, getTimezoneAbbreviation, getTimezoneLongName, timezoneStringToTimezoneInfo, searchTimezoneInfos, timezoneStringToSearchableString, isKnownTimezone, allTimezoneInfos } from './timezone';
import { UTC_TIMEZONE_STRING } from '@dereekb/util';

describe('allTimezoneStrings()', () => {
  it('should return an array of timezone strings', () => {
    const result = allTimezoneStrings();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include UTC', () => {
    const result = allTimezoneStrings();
    expect(result).toContain(UTC_TIMEZONE_STRING);
  });
});

describe('allKnownTimezoneStrings()', () => {
  it('should return a Set', () => {
    const result = allKnownTimezoneStrings();
    expect(result).toBeInstanceOf(Set);
  });

  it('should contain America/New_York', () => {
    expect(allKnownTimezoneStrings().has('America/New_York')).toBe(true);
  });
});

describe('allTimezoneInfos()', () => {
  it('should return an array of TimezoneInfo objects', () => {
    const result = allTimezoneInfos();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].timezone).toBeDefined();
    expect(result[0].abbreviation).toBeDefined();
    expect(result[0].search).toBeDefined();
  });
});

describe('timezoneInfoForSystem()', () => {
  it('should return a valid TimezoneInfo', () => {
    const result = timezoneInfoForSystem();
    expect(result.timezone).toBeDefined();
    expect(result.abbreviation).toBeDefined();
  });
});

describe('getTimezoneAbbreviation()', () => {
  it('should return UTC for UTC timezone', () => {
    const result = getTimezoneAbbreviation(UTC_TIMEZONE_STRING);
    expect(result).toBe(UTC_TIMEZONE_STRING);
  });

  it('should return UNKNOWN for undefined timezone', () => {
    const result = getTimezoneAbbreviation(undefined);
    expect(result).toBe('UNKNOWN');
  });

  it('should return an abbreviation for a valid timezone', () => {
    const result = getTimezoneAbbreviation('America/New_York');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getTimezoneLongName()', () => {
  it('should return Unknown Timezone for undefined', () => {
    const result = getTimezoneLongName(undefined);
    expect(result).toBe('Unknown Timezone');
  });

  it('should return a long name for a valid timezone', () => {
    const result = getTimezoneLongName('America/New_York');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('timezoneStringToTimezoneInfo()', () => {
  it('should create a TimezoneInfo with all fields populated', () => {
    const result = timezoneStringToTimezoneInfo('America/Chicago');
    expect(result.timezone).toBe('America/Chicago');
    expect(result.search).toBe('america chicago');
    expect(result.lowercase).toBe('america/chicago');
    expect(result.abbreviation).toBeDefined();
    expect(result.lowercaseAbbreviation).toBeDefined();
  });
});

describe('searchTimezoneInfos()', () => {
  it('should find timezones by search string', () => {
    const infos = allTimezoneInfos();
    const results = searchTimezoneInfos('chicago', infos);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((x) => x.timezone === 'America/Chicago')).toBe(true);
  });

  it('should find timezones by abbreviation', () => {
    const infos = allTimezoneInfos();
    const results = searchTimezoneInfos('UTC', infos);

    expect(results.length).toBeGreaterThan(0);
  });
});

describe('timezoneStringToSearchableString()', () => {
  it('should convert slashes and underscores to spaces and lowercase', () => {
    expect(timezoneStringToSearchableString('America/New_York')).toBe('america new york');
  });

  it('should lowercase the timezone', () => {
    expect(timezoneStringToSearchableString('UTC')).toBe('utc');
  });
});

describe('isKnownTimezone()', () => {
  it('should return true for a known timezone', () => {
    expect(isKnownTimezone('America/New_York')).toBe(true);
  });

  it('should return false for an unknown timezone', () => {
    expect(isKnownTimezone('Mars/Olympus')).toBe(false);
  });

  it('should return true for UTC', () => {
    expect(isKnownTimezone(UTC_TIMEZONE_STRING)).toBe(true);
  });
});
