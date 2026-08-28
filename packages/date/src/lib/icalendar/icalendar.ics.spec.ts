import { wrapDateTests } from '../../test.spec';
import { ICALENDAR_LINE_BREAK, ICALENDAR_MAX_LINE_OCTETS } from './icalendar';
import { type ICalendarComponent } from './icalendar.component';
import { foldICalendarLine, iCalendarComponentToIcsString, iCalendarContentLineToUnfoldedString, iCalendarFoldedLineString, iCalendarLineAtoms, iCalendarToIcsString, unfoldIcsString, utf8OctetLength } from './icalendar.ics';

wrapDateTests(() => {
  describe('utf8OctetLength()', () => {
    it('should count an ASCII string as one octet per character.', () => {
      expect(utf8OctetLength('abc')).toBe(3);
    });

    it('should count a two-octet character.', () => {
      expect(utf8OctetLength('é')).toBe(2);
    });

    it('should count a three-octet character.', () => {
      expect(utf8OctetLength('東')).toBe(3);
    });

    it('should count a four-octet character once, not twice for its surrogate pair.', () => {
      expect('🎉'.length).toBe(2);
      expect(utf8OctetLength('🎉')).toBe(4);
    });

    it('should count an empty string as zero.', () => {
      expect(utf8OctetLength('')).toBe(0);
    });
  });

  describe('iCalendarLineAtoms()', () => {
    it('should treat each ASCII character as its own atom.', () => {
      expect(iCalendarLineAtoms('abc')).toEqual(['a', 'b', 'c']);
    });

    it('should keep an escape pair together.', () => {
      expect(iCalendarLineAtoms(String.raw`a\,b`)).toEqual(['a', String.raw`\,`, 'b']);
    });

    it('should keep an escaped backslash together.', () => {
      expect(iCalendarLineAtoms(String.raw`a\\b`)).toEqual(['a', '\\\\', 'b']);
    });

    it('should keep a surrogate pair together.', () => {
      expect(iCalendarLineAtoms('a🎉b')).toEqual(['a', '🎉', 'b']);
    });

    it('should treat a trailing backslash as its own atom.', () => {
      expect(iCalendarLineAtoms('a\\')).toEqual(['a', '\\']);
    });
  });

  describe('foldICalendarLine()', () => {
    it('should not fold a line of exactly 75 octets.', () => {
      const line = 'a'.repeat(ICALENDAR_MAX_LINE_OCTETS);
      const folded = foldICalendarLine(line);

      expect(folded.length).toBe(1);
      expect(folded[0]).toBe(line);
    });

    it('should fold a line of 76 octets exactly once.', () => {
      const line = 'a'.repeat(ICALENDAR_MAX_LINE_OCTETS + 1);
      const folded = foldICalendarLine(line);

      expect(folded.length).toBe(2);
      expect(folded[0].length).toBe(75);
      expect(folded[1].length).toBe(1);
    });

    it('should budget 74 octets for each continuation, since the fold space counts toward the limit.', () => {
      // 75 for the first line, then 74 per continuation
      const line = 'a'.repeat(75 + 74 + 74);
      const folded = foldICalendarLine(line);

      expect(folded.map((x) => x.length)).toEqual([75, 74, 74]);
    });

    it('should fold a long value into multiple lines that reassemble to the original.', () => {
      const line = `DESCRIPTION:${'the quick brown fox jumps over the lazy dog. '.repeat(10)}`;
      const folded = foldICalendarLine(line);

      expect(folded.length).toBeGreaterThan(3);
      expect(folded.join('')).toBe(line);
      folded.forEach((x) => expect(utf8OctetLength(x)).toBeLessThanOrEqual(ICALENDAR_MAX_LINE_OCTETS));
    });

    it('should never split a multi-byte character across a fold.', () => {
      // 'é' is two octets, so a run of them will not land evenly on the 75-octet boundary
      const line = 'é'.repeat(120);
      const folded = foldICalendarLine(line);

      expect(folded.join('')).toBe(line);
      folded.forEach((x) => {
        expect(utf8OctetLength(x)).toBeLessThanOrEqual(ICALENDAR_MAX_LINE_OCTETS);
        expect(x.includes('�')).toBe(false);
      });
    });

    it('should never split a CJK character across a fold.', () => {
      const line = '東京'.repeat(60);
      const folded = foldICalendarLine(line);

      expect(folded.join('')).toBe(line);
      folded.forEach((x) => expect(utf8OctetLength(x)).toBeLessThanOrEqual(ICALENDAR_MAX_LINE_OCTETS));
    });

    it('should never split a surrogate pair across a fold.', () => {
      const line = `${'a'.repeat(74)}🎉${'a'.repeat(80)}`;
      const folded = foldICalendarLine(line);

      expect(folded.join('')).toBe(line);
      // the emoji does not fit in the one remaining octet of the first line, so it moves whole to the next
      expect(folded[0]).toBe('a'.repeat(74));
      expect(folded[1].startsWith('🎉')).toBe(true);
      folded.forEach((x) => expect(utf8OctetLength(x)).toBeLessThanOrEqual(ICALENDAR_MAX_LINE_OCTETS));
    });

    it('should never split an escape pair across a fold.', () => {
      const line = String.raw`${'a'.repeat(74)}\,${'a'.repeat(10)}`;
      const folded = foldICalendarLine(line);

      expect(folded.join('')).toBe(line);
      expect(folded[0]).toBe('a'.repeat(74));
      expect(folded[1].startsWith(String.raw`\,`)).toBe(true);
    });

    it('should return a single empty line for an empty input.', () => {
      expect(foldICalendarLine('')).toEqual(['']);
    });
  });

  describe('iCalendarFoldedLineString()', () => {
    it('should join continuations with CRLF plus a single space.', () => {
      const line = 'a'.repeat(80);
      expect(iCalendarFoldedLineString(line)).toBe(`${'a'.repeat(75)}\r\n ${'a'.repeat(5)}`);
    });
  });

  describe('iCalendarContentLineToUnfoldedString()', () => {
    it('should assemble a line with no parameters.', () => {
      expect(iCalendarContentLineToUnfoldedString({ name: 'SUMMARY', value: 'Hello' })).toBe('SUMMARY:Hello');
    });

    it('should assemble a line with one parameter.', () => {
      expect(iCalendarContentLineToUnfoldedString({ name: 'DTSTART', value: '20260315T090000', parameters: [{ name: 'TZID', value: 'America/Denver' }] })).toBe('DTSTART;TZID=America/Denver:20260315T090000');
    });

    it('should assemble a line with several parameters.', () => {
      expect(
        iCalendarContentLineToUnfoldedString({
          name: 'ATTENDEE',
          value: 'mailto:a@example.com',
          parameters: [
            { name: 'CN', value: 'A' },
            { name: 'RSVP', value: 'TRUE' }
          ]
        })
      ).toBe('ATTENDEE;CN=A;RSVP=TRUE:mailto:a@example.com');
    });
  });

  describe('iCalendarComponentToIcsString()', () => {
    it('should wrap the component in BEGIN/END and terminate every line with CRLF.', () => {
      const component: ICalendarComponent = { name: 'VCALENDAR', lines: [{ name: 'VERSION', value: '2.0' }] };
      expect(iCalendarComponentToIcsString(component)).toBe('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n');
    });

    it('should nest child components between the parent lines and the END line.', () => {
      const component: ICalendarComponent = {
        name: 'VCALENDAR',
        lines: [{ name: 'VERSION', value: '2.0' }],
        components: [{ name: 'VEVENT', lines: [{ name: 'UID', value: 'a' }] }]
      };

      expect(iCalendarComponentToIcsString(component)).toBe('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
    });

    it('should terminate the final END line with CRLF.', () => {
      const component: ICalendarComponent = { name: 'VCALENDAR', lines: [] };
      expect(iCalendarComponentToIcsString(component).endsWith(ICALENDAR_LINE_BREAK)).toBe(true);
    });
  });

  describe('unfoldIcsString()', () => {
    it('should round-trip a folded document back to its logical lines.', () => {
      const description = 'x'.repeat(300);
      const ics = iCalendarToIcsString({ events: [{ uid: 'a@example.com', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') }, description }] }, { now: new Date('2026-03-01T00:00:00Z') });

      const lines = unfoldIcsString(ics);
      expect(lines).toContain(`DESCRIPTION:${description}`);
      expect(lines[0]).toBe('BEGIN:VCALENDAR');
      expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    });

    it('should preserve a multi-byte value through a fold/unfold round trip.', () => {
      const description = '東京'.repeat(80);
      const ics = iCalendarToIcsString({ events: [{ uid: 'a@example.com', start: { type: 'utc', at: new Date('2026-03-15T14:00:00Z') }, description }] }, { now: new Date('2026-03-01T00:00:00Z') });

      expect(unfoldIcsString(ics)).toContain(`DESCRIPTION:${description}`);
    });

    it('should fold an extra property value that exceeds the max line length.', () => {
      const value = 'x'.repeat(300);
      const ics = iCalendarToIcsString({ events: [], extraProperties: [{ name: 'X-LONG', value }] }, { now: new Date('2026-03-01T00:00:00Z') });

      expect(ics.split(ICALENDAR_LINE_BREAK).every((x) => x.length <= ICALENDAR_MAX_LINE_OCTETS)).toBe(true);
      expect(unfoldIcsString(ics)).toContain(`X-LONG:${value}`);
    });

    it('should escape the TEXT specials in an extra property value.', () => {
      const ics = iCalendarToIcsString({ events: [], extraProperties: [{ name: 'X-ESCAPED', value: 'a;b,c\nd' }] }, { now: new Date('2026-03-01T00:00:00Z') });

      expect(unfoldIcsString(ics)).toContain(String.raw`X-ESCAPED:a\;b\,c\nd`);
    });
  });
});
