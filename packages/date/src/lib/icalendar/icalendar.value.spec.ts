import { wrapDateTests } from '../../test.spec';
import { escapeICalendarText, hasICalendarValue, iCalendarBooleanValue, iCalendarCalAddressValue, iCalendarDateString, iCalendarDurationString, iCalendarFloatingDateTimeString, iCalendarGeoValue, iCalendarIntegerValue, iCalendarParameterValue, iCalendarTextListValue, iCalendarTextValue, iCalendarUtcDateTimeString, iCalendarUtcOffsetString, iCalendarZonedDateTimeString } from './icalendar.value';

wrapDateTests(() => {
  describe('iCalendarTextValue()', () => {
    it('should escape a backslash.', () => {
      expect(iCalendarTextValue(String.raw`a\b`)).toBe(String.raw`a\\b`);
    });

    it('should escape a semicolon.', () => {
      expect(iCalendarTextValue('a;b')).toBe(String.raw`a\;b`);
    });

    it('should escape a comma.', () => {
      expect(iCalendarTextValue('a,b')).toBe(String.raw`a\,b`);
    });

    it(String.raw`should escape a newline as a literal \n.`, () => {
      expect(iCalendarTextValue('a\nb')).toBe(String.raw`a\nb`);
    });

    it('should normalize a CRLF to a single escaped newline.', () => {
      expect(iCalendarTextValue('a\r\nb')).toBe(String.raw`a\nb`);
    });

    it('should normalize a bare CR to a single escaped newline.', () => {
      expect(iCalendarTextValue('a\rb')).toBe(String.raw`a\nb`);
    });

    it('should NOT escape a colon.', () => {
      expect(iCalendarTextValue('Meeting: standup')).toBe('Meeting: standup');
    });

    it('should escape a value containing every escapable character.', () => {
      expect(iCalendarTextValue('a\\b;c,d\ne\r\nf\rg:h')).toBe(String.raw`a\\b\;c\,d\ne\nf\ng:h`);
    });

    it('should not double-escape an already-inserted escape character.', () => {
      // the backslash is escaped once, and the comma that follows it is escaped once
      expect(iCalendarTextValue(String.raw`\,`)).toBe(String.raw`\\\,`);
    });

    it('should return the input unchanged when nothing needs escaping.', () => {
      expect(iCalendarTextValue('nothing to do here')).toBe('nothing to do here');
    });

    it('should preserve multi-byte characters.', () => {
      expect(iCalendarTextValue('café 東京 🎉')).toBe('café 東京 🎉');
    });
  });

  describe('escapeICalendarText()', () => {
    it('should escape a pre-normalized string.', () => {
      expect(escapeICalendarText('a,b')).toBe(String.raw`a\,b`);
    });
  });

  describe('iCalendarTextListValue()', () => {
    it('should join values with a comma.', () => {
      expect(iCalendarTextListValue(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('should escape a comma inside an element so it is not read as a separator.', () => {
      expect(iCalendarTextListValue(['a,b', 'c'])).toBe(String.raw`a\,b,c`);
    });

    it('should return an empty string for an empty list.', () => {
      expect(iCalendarTextListValue([])).toBe('');
    });
  });

  describe('iCalendarUtcDateTimeString()', () => {
    it('should render the UTC wall clock regardless of the system timezone.', () => {
      expect(iCalendarUtcDateTimeString(new Date('2026-03-15T14:00:00Z'))).toBe('20260315T140000Z');
    });

    it('should render midnight UTC on the correct calendar day.', () => {
      expect(iCalendarUtcDateTimeString(new Date('2026-01-01T00:00:00Z'))).toBe('20260101T000000Z');
    });

    it('should render the last second of a year.', () => {
      expect(iCalendarUtcDateTimeString(new Date('2026-12-31T23:59:59Z'))).toBe('20261231T235959Z');
    });
  });

  describe('iCalendarZonedDateTimeString()', () => {
    it('should render the wall clock of the target zone with no Z suffix.', () => {
      expect(iCalendarZonedDateTimeString(new Date('2026-03-15T14:00:00Z'), 'America/Denver')).toBe('20260315T080000');
    });

    it('should render a wall clock that crosses the date line.', () => {
      expect(iCalendarZonedDateTimeString(new Date('2026-03-15T20:00:00Z'), 'Asia/Tokyo')).toBe('20260316T050000');
    });

    it('should render the UTC wall clock when the target zone is UTC.', () => {
      expect(iCalendarZonedDateTimeString(new Date('2026-03-15T14:00:00Z'), 'UTC')).toBe('20260315T140000');
    });
  });

  describe('iCalendarFloatingDateTimeString()', () => {
    it('should render the UTC wall clock with no Z suffix.', () => {
      expect(iCalendarFloatingDateTimeString(new Date('2026-03-15T14:00:00Z'))).toBe('20260315T140000');
    });
  });

  describe('iCalendarDateString()', () => {
    it('should strip the dashes from an ISO 8601 day string.', () => {
      expect(iCalendarDateString('2026-03-15')).toBe('20260315');
    });

    it('should handle a leap day.', () => {
      expect(iCalendarDateString('2024-02-29')).toBe('20240229');
    });
  });

  describe('iCalendarDurationString()', () => {
    it('should render a sub-hour duration.', () => {
      expect(iCalendarDurationString(15)).toBe('PT15M');
    });

    it('should render a whole-hour duration.', () => {
      expect(iCalendarDurationString(60)).toBe('PT1H');
    });

    it('should render an hours-and-minutes duration.', () => {
      expect(iCalendarDurationString(90)).toBe('PT1H30M');
    });

    it('should render a whole-day duration in days.', () => {
      expect(iCalendarDurationString(1440)).toBe('P1D');
      expect(iCalendarDurationString(2880)).toBe('P2D');
    });

    it('should render a multi-hour duration that is not a whole number of days in hours.', () => {
      expect(iCalendarDurationString(1500)).toBe('PT25H');
    });

    it('should render zero as PT0S.', () => {
      expect(iCalendarDurationString(0)).toBe('PT0S');
    });

    it('should render a negative duration with a leading minus.', () => {
      expect(iCalendarDurationString(-15)).toBe('-PT15M');
      expect(iCalendarDurationString(-1440)).toBe('-P1D');
    });
  });

  describe('iCalendarUtcOffsetString()', () => {
    it('should render a negative whole-hour offset.', () => {
      expect(iCalendarUtcOffsetString(-360)).toBe('-0600');
    });

    it('should render a positive half-hour offset.', () => {
      expect(iCalendarUtcOffsetString(330)).toBe('+0530');
    });

    it('should render zero as +0000.', () => {
      expect(iCalendarUtcOffsetString(0)).toBe('+0000');
    });

    it('should render a large positive offset.', () => {
      expect(iCalendarUtcOffsetString(840)).toBe('+1400');
    });
  });

  describe('iCalendarParameterValue()', () => {
    it('should pass a plain value through unquoted.', () => {
      expect(iCalendarParameterValue('America/Denver')).toBe('America/Denver');
    });

    it('should quote a value containing a comma.', () => {
      expect(iCalendarParameterValue('Smith, John')).toBe('"Smith, John"');
    });

    it('should quote a value containing a colon.', () => {
      expect(iCalendarParameterValue('https://example.com')).toBe('"https://example.com"');
    });

    it('should quote a value containing a semicolon.', () => {
      expect(iCalendarParameterValue('a;b')).toBe('"a;b"');
    });

    it('should strip a double quote, which has no representation in a parameter value.', () => {
      expect(iCalendarParameterValue('say "hi"')).toBe('say hi');
    });
  });

  describe('iCalendarCalAddressValue()', () => {
    it('should prefix a bare email address with mailto:.', () => {
      expect(iCalendarCalAddressValue('person@example.com')).toBe('mailto:person@example.com');
    });

    it('should pass an already-schemed URI through.', () => {
      expect(iCalendarCalAddressValue('mailto:person@example.com')).toBe('mailto:person@example.com');
      expect(iCalendarCalAddressValue('https://example.com/person')).toBe('https://example.com/person');
    });
  });

  describe('iCalendarGeoValue()', () => {
    it('should render a point as a semicolon-separated pair.', () => {
      expect(iCalendarGeoValue({ lat: 39.7392, lng: -104.9903 })).toBe('39.7392;-104.9903');
    });
  });

  describe('iCalendarBooleanValue()', () => {
    it('should render booleans in upper case.', () => {
      expect(iCalendarBooleanValue(true)).toBe('TRUE');
      expect(iCalendarBooleanValue(false)).toBe('FALSE');
    });
  });

  describe('iCalendarIntegerValue()', () => {
    it('should render an integer.', () => {
      expect(iCalendarIntegerValue(5)).toBe('5');
    });

    it('should truncate a fractional value toward zero.', () => {
      expect(iCalendarIntegerValue(5.9)).toBe('5');
      expect(iCalendarIntegerValue(-5.9)).toBe('-5');
    });
  });

  describe('hasICalendarValue()', () => {
    it('should be true for a non-empty string.', () => {
      expect(hasICalendarValue('a')).toBe(true);
    });

    it('should be false for an empty or whitespace-only string.', () => {
      expect(hasICalendarValue('')).toBe(false);
      expect(hasICalendarValue('   ')).toBe(false);
    });

    it('should be false for null/undefined.', () => {
      expect(hasICalendarValue(undefined)).toBe(false);
      expect(hasICalendarValue(null)).toBe(false);
    });
  });
});
