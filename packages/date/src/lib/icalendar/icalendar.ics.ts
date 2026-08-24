import { type Maybe } from '@dereekb/util';
import { type ICalendarIcsString, ICALENDAR_FOLD_PREFIX, ICALENDAR_LINE_BREAK, ICALENDAR_MAX_LINE_OCTETS, ICALENDAR_PARAMETER_SPLITTER, ICALENDAR_VALUE_SPLITTER } from './icalendar';
import { type ICalendarComponent, type ICalendarContentLine, iCalendarToComponent } from './icalendar.component';
import { type ICalendar, type ICalendarSerializeConfig } from './icalendar.model';

/**
 * Returns the number of octets the given string occupies when encoded as UTF-8.
 *
 * Computed from the code points directly rather than through a platform encoder, so the serializer stays
 * free of any Node or browser API.
 *
 * @param input - The string to measure.
 * @returns The UTF-8 octet length.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function utf8OctetLength(input: string): number {
  let length = 0;

  for (const char of input) {
    const codePoint = char.codePointAt(0) as number;

    if (codePoint < 0x80) {
      length += 1;
    } else if (codePoint < 0x800) {
      length += 2;
    } else if (codePoint < 0x10000) {
      length += 3;
    } else {
      length += 4;
    }
  }

  return length;
}

/**
 * Splits a line into the smallest units a fold is allowed to fall between.
 *
 * An atom is a single code point, except that a backslash and the character it escapes form one atom.
 * Iterating by code point (rather than by UTF-16 index) is what keeps a surrogate pair — an emoji — intact;
 * keeping escape pairs together is defensive, since unfolding restores the octet stream and a split escape is
 * technically legal, but real-world parsers choke on it.
 *
 * @param line - The assembled, already-escaped content line.
 * @returns The atoms of the line, in order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarLineAtoms(line: string): readonly string[] {
  const codePoints = Array.from(line);
  const atoms: string[] = [];

  let i = 0;

  while (i < codePoints.length) {
    const codePoint = codePoints[i];

    if (codePoint === '\\' && i + 1 < codePoints.length) {
      atoms.push(codePoint + codePoints[i + 1]);
      i += 2;
    } else {
      atoms.push(codePoint);
      i += 1;
    }
  }

  return atoms;
}

/**
 * Folds a single assembled content line into physical lines of at most 75 octets each.
 *
 * The returned values carry no fold prefix and no line break; see {@link iCalendarFoldedLineString}.
 *
 * A continuation line's leading space counts toward the 75-octet limit, so every line after the first has a
 * payload budget of 74 octets.
 *
 * @param line - The assembled, already-escaped content line.
 * @returns The physical line payloads, in order. Always at least one.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function foldICalendarLine(line: string): readonly string[] {
  const atoms = iCalendarLineAtoms(line);
  const results: string[] = [];

  const foldPrefixOctets = utf8OctetLength(ICALENDAR_FOLD_PREFIX);
  let budget = ICALENDAR_MAX_LINE_OCTETS;
  let current = '';
  let currentOctets = 0;

  atoms.forEach((atom) => {
    const atomOctets = utf8OctetLength(atom);

    // currentOctets > 0 guarantees progress even for an atom wider than the budget
    if (currentOctets > 0 && currentOctets + atomOctets > budget) {
      results.push(current);
      budget = ICALENDAR_MAX_LINE_OCTETS - foldPrefixOctets;
      current = '';
      currentOctets = 0;
    }

    current += atom;
    currentOctets += atomOctets;
  });

  results.push(current);
  return results;
}

/**
 * Folds a single assembled content line and joins the result with CRLF-prefixed continuations.
 *
 * The result does NOT carry a trailing line break.
 *
 * @param line - The assembled, already-escaped content line.
 * @returns The folded line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarFoldedLineString(line: string): string {
  return foldICalendarLine(line).join(`${ICALENDAR_LINE_BREAK}${ICALENDAR_FOLD_PREFIX}`);
}

/**
 * Assembles a content line into its unfolded ICS representation.
 *
 * I.E. `DTSTART;TZID=America/Denver:20260315T090000`. Both the parameters and the value are expected to have
 * been encoded already; this only joins them with the structural delimiters.
 *
 * @param line - The content line to assemble.
 * @returns The unfolded line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarContentLineToUnfoldedString(line: ICalendarContentLine): string {
  const parameters = (line.parameters ?? []).map((x) => `${ICALENDAR_PARAMETER_SPLITTER}${x.name}=${x.value}`).join('');
  return `${line.name}${parameters}${ICALENDAR_VALUE_SPLITTER}${line.value}`;
}

/**
 * Collects the folded physical lines of a component and its nested components, in order.
 *
 * @param component - Component to walk.
 * @param into - Accumulator the physical lines are appended to.
 */
function pushICalendarComponentLines(component: ICalendarComponent, into: string[]): void {
  into.push(iCalendarFoldedLineString(`BEGIN${ICALENDAR_VALUE_SPLITTER}${component.name}`));
  component.lines.forEach((line) => into.push(iCalendarFoldedLineString(iCalendarContentLineToUnfoldedString(line))));
  component.components?.forEach((child) => pushICalendarComponentLines(child, into));
  into.push(iCalendarFoldedLineString(`END${ICALENDAR_VALUE_SPLITTER}${component.name}`));
}

/**
 * Serializes a component tree as an RFC 5545 ICS document.
 *
 * THE ONLY ICS-AWARE STEP. Everything specific to the text serialization — BEGIN/END wrappers, the `:` and
 * `;` delimiters, 75-octet folding and CRLF line endings — lives here and nowhere else, so an alternate
 * serialization of the same data model (jCal, xCal) replaces this function alone.
 *
 * @param component - The component tree to serialize.
 * @returns The ICS document, CRLF-terminated including after the final line.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarComponentToIcsString(component: ICalendarComponent): ICalendarIcsString {
  const lines: string[] = [];
  pushICalendarComponentLines(component, lines);

  // RFC 5545 3.1: every content line, including the last, is terminated by CRLF
  return `${lines.join(ICALENDAR_LINE_BREAK)}${ICALENDAR_LINE_BREAK}`;
}

/**
 * Serializes a calendar as an RFC 5545 ICS document.
 *
 * @param calendar - The calendar to serialize.
 * @param config - Optional serialization config, notably the DTSTAMP source.
 * @returns The ICS document, CRLF-terminated including after the final line.
 *
 * @example
 * ```ts
 * iCalendarToIcsString({ name: 'My Feed', events: [] }, { now: new Date('2026-03-15T14:00:00Z') });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarToIcsString(calendar: ICalendar, config?: Maybe<ICalendarSerializeConfig>): ICalendarIcsString {
  return iCalendarComponentToIcsString(iCalendarToComponent(calendar, config));
}

/**
 * Reverses the 75-octet folding of an ICS document, yielding the logical content lines.
 *
 * Useful for validating or re-parsing emitted output.
 *
 * @param ics - The ICS document to unfold.
 * @returns The logical content lines, with the trailing empty line removed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function unfoldIcsString(ics: ICalendarIcsString): readonly string[] {
  const physicalLines = ics.split(ICALENDAR_LINE_BREAK);
  const results: string[] = [];

  physicalLines.forEach((physicalLine, i) => {
    if (i > 0 && results.length > 0 && physicalLine.startsWith(ICALENDAR_FOLD_PREFIX)) {
      results[results.length - 1] += physicalLine.slice(ICALENDAR_FOLD_PREFIX.length);
    } else if (physicalLine.length > 0) {
      results.push(physicalLine);
    }
  });

  return results;
}
